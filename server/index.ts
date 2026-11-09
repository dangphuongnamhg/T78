import { config as loadEnv } from 'dotenv'
loadEnv({override:true})
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { detectEmotion, isHighRisk, mockReply } from './chatbot.js'

type Role = 'student' | 'teacher' | 'admin'
type User = { id: string; name: string; email: string; password: string; role: Role }
type Chat = { id: string; userId: string; title: string; createdAt: string; messages: { id:string; role:'user'|'assistant'; content:string; emotion?:string; createdAt:string }[] }
type Mood = { id:string; userId:string; mood:string; intensity:number; note?:string; createdAt:string }
const users: User[] = []
const chats: Chat[] = []
const moods: Mood[] = []
const db = process.env.DATABASE_URL ? new PrismaClient() : null
const app = express()
const port = Number(process.env.PORT || 4000)
const secret = process.env.JWT_SECRET || 'mindschool-local-development-secret-change-before-deploy'
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production')
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: false }))
app.use(express.json({ limit: '12kb' }))
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');next()})

function rateLimit(max:number, windowMs:number) {
  const hits = new Map<string,{count:number;resetAt:number}>()
  return (req:express.Request,res:express.Response,next:express.NextFunction)=>{
    const now=Date.now();const key=req.ip||'unknown';let entry=hits.get(key)
    if(!entry||entry.resetAt<=now){entry={count:0,resetAt:now+windowMs};hits.set(key,entry)}
    entry.count++
    if(entry.count>max){res.setHeader('Retry-After',String(Math.ceil((entry.resetAt-now)/1000)));return res.status(429).json({error:'Bạn thử lại sau ít phút nhé.'})}
    if(hits.size>5000)for(const [k,v] of hits)if(v.resetAt<=now)hits.delete(k)
    next()
  }
}
const authLimiter=rateLimit(20,15*60*1000)
const chatLimiter=rateLimit(40,60*1000)

const emailList=(key:string)=>new Set((process.env[key]||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean))
function configuredRole(email:string):Role{
  if(emailList('ADMIN_EMAILS').has(email))return 'admin'
  if(emailList('TEACHER_EMAILS').has(email))return 'teacher'
  return 'student'
}

const auth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' })
  try {
    const id=(jwt.verify(token,secret) as jwt.JwtPayload).sub
    if(typeof id!=='string')return res.status(401).json({error:'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại nhé.'})
    const account=db?await db.user.findUnique({where:{id},select:{role:true,email:true}}):users.find(u=>u.id===id)
    if(!account)return res.status(401).json({error:'Tài khoản không còn tồn tại.'})
    const role=configuredRole(account.email)
    if(account.role!==role){if(db)await db.user.update({where:{id},data:{role}});else{const memoryUser=users.find(u=>u.id===id);if(memoryUser)memoryUser.role=role}}
    ;(req as any).userId=id;(req as any).role=role;next()
  } catch { return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại nhé.' }) }
}
const requireStaff=(req:express.Request,res:express.Response,next:express.NextFunction)=>{
  if((req as any).role!=='teacher'&&(req as any).role!=='admin')return res.status(403).json({error:'Khu vực này chỉ dành cho giáo viên và quản trị viên.'})
  next()
}
const tokenFor = (u: User) => jwt.sign({ sub: u.id }, secret, { expiresIn: '7d' })
const emailSchema = z.string().email().max(254).transform(s=>s.toLowerCase())
const credentials = z.object({ email: emailSchema, password: z.string().min(8).max(100) })
app.get('/api/health', (_req,res)=>res.json({ ok:true, mode:process.env.OPENAI_API_KEY?'openai':'mock', storage:db?'mariadb':'memory' }))
app.post('/api/auth/signup', authLimiter, async (req,res)=>{
  const parsed = credentials.extend({ name:z.string().trim().min(2).max(60) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({error:'Vui lòng kiểm tra tên, email và mật khẩu (ít nhất 8 ký tự).'})
  const existing=db?await db.user.findUnique({where:{email:parsed.data.email}}):users.find(u=>u.email===parsed.data.email)
  if (existing) return res.status(409).json({error:'Email này đã được đăng ký rồi.'})
  const password=await bcrypt.hash(parsed.data.password,12)
  const role=configuredRole(parsed.data.email)
  const created=db?await db.user.create({data:{name:parsed.data.name,email:parsed.data.email,password,role}}):{id:randomUUID(),name:parsed.data.name,email:parsed.data.email,password,role}
  const u:User={id:created.id,name:created.name,email:created.email,password:created.password,role:created.role as Role}
  if(!db)users.push(u)
  res.status(201).json({token:tokenFor(u),user:{id:u.id,name:u.name,email:u.email,role:u.role}})
})
app.post('/api/auth/signin', authLimiter, async (req,res)=>{
  const parsed=credentials.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Email hoặc mật khẩu chưa đúng định dạng.'})
  const found=db?await db.user.findUnique({where:{email:parsed.data.email}}):users.find(x=>x.email===parsed.data.email);if(!found||!(await bcrypt.compare(parsed.data.password,found.password)))return res.status(401).json({error:'Email hoặc mật khẩu chưa đúng.'})
  const role=configuredRole(found.email)
  const u:User={id:found.id,name:found.name,email:found.email,password:found.password,role}
  if(db&&found.role!==role)await db.user.update({where:{id:found.id},data:{role}})
  if(!db){const memoryUser=users.find(x=>x.id===found.id);if(memoryUser)memoryUser.role=role}
  res.json({token:tokenFor(u),user:{id:u.id,name:u.name,email:u.email,role:u.role}})
})
app.get('/api/profile',auth,async(req,res)=>{const id=(req as any).userId;const u=db?await db.user.findUnique({where:{id},select:{id:true,name:true,email:true,role:true}}):users.find(x=>x.id===id);if(!u)return res.status(404).json({error:'Không tìm thấy tài khoản.'});res.json({id:u.id,name:u.name,email:u.email,role:u.role})})
app.delete('/api/auth/account',auth,async(req,res)=>{const id=(req as any).userId;if(db)await db.user.deleteMany({where:{id}});else{const i=users.findIndex(u=>u.id===id);if(i>=0)users.splice(i,1);for(let j=chats.length-1;j>=0;j--)if(chats[j].userId===id)chats.splice(j,1);for(let j=moods.length-1;j>=0;j--)if(moods[j].userId===id)moods.splice(j,1)}res.status(204).end()})

app.get('/api/chats',auth,async(req,res)=>{const userId=(req as any).userId;if(db){const rows=await db.chatSession.findMany({where:{userId},select:{id:true,title:true,createdAt:true},orderBy:{createdAt:'desc'}});return res.json(rows)}res.json(chats.filter(c=>c.userId===userId).map(({id,title,createdAt})=>({id,title,createdAt})).reverse())})
app.post('/api/chats',auth,async(req,res)=>{const parsed=z.object({title:z.string().trim().max(80).optional()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Tên cuộc trò chuyện chưa hợp lệ.'});const title=parsed.data.title||'Một cuộc trò chuyện mới';const userId=(req as any).userId;if(db){const chat=await db.chatSession.create({data:{title,userId},select:{id:true,title:true,createdAt:true}});return res.status(201).json(chat)}const chat:Chat={id:randomUUID(),userId,title,createdAt:new Date().toISOString(),messages:[]};chats.push(chat);res.status(201).json({id:chat.id,title:chat.title,createdAt:chat.createdAt})})
app.get('/api/chats/:id',auth,async(req,res)=>{const id=String(req.params.id);const userId=(req as any).userId;if(db){const c=await db.chatSession.findFirst({where:{id,userId},include:{messages:{orderBy:{createdAt:'asc'}}}});if(!c)return res.status(404).json({error:'Không tìm thấy cuộc trò chuyện.'});return res.json(c)}const c=chats.find(x=>x.id===id&&x.userId===userId);if(!c)return res.status(404).json({error:'Không tìm thấy cuộc trò chuyện.'});res.json({id:c.id,title:c.title,createdAt:c.createdAt,messages:c.messages})})

const crisisReply='Mình rất tiếc vì bạn đang phải mang cảm giác nặng nề này. An toàn của bạn là điều quan trọng nhất ngay lúc này. Nếu có thể, hãy đến cạnh một người lớn mà bạn tin tưởng (người thân, thầy cô hoặc tư vấn học đường) và nói rõ rằng bạn cần họ ở bên ngay bây giờ. Nếu bạn đang gặp nguy hiểm tức thời, hãy gọi dịch vụ khẩn cấp tại nơi bạn sống hoặc đến cơ sở y tế gần nhất. Bạn không cần phải tự mình xử lý điều này. Mình có thể ở đây cùng bạn trong lúc bạn tìm người hỗ trợ.'
type AIReply = { content: string; source: 'openai' | 'mock' | 'fallback' }
async function replyFromAI(text:string,emotion:string):Promise<AIReply>{
  const key=process.env.OPENAI_API_KEY;if(!key)return {content:mockReply(text,emotion),source:'mock'}
  try{
    const r=await fetch(`${(process.env.OPENAI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',temperature:.65,max_tokens:240,messages:[{role:'system',content:'Bạn là Mây, người bạn đồng hành cảm xúc cho học sinh Việt Nam. Trả lời tiếng Việt tự nhiên, ấm áp, ngắn gọn (2-4 câu), không phán xét, đặt câu hỏi nhẹ nhàng và gợi ý một bước nhỏ thực tế. Không chẩn đoán, không khẳng định chắc chắn cảm xúc. Không thay thế người lớn/chuyên gia. Nếu nguy cơ cao, chuyển người dùng đến người lớn tin cậy hoặc dịch vụ khẩn cấp. Không yêu cầu thông tin định danh.'},{role:'user',content:`Cảm xúc tham khảo: ${emotion}. Nội dung: ${text}`} ]})})
    if(!r.ok)return {content:mockReply(text,emotion),source:'fallback'}
    const data=await r.json() as any
    const content=String(data.choices?.[0]?.message?.content||'').trim()
    return content?{content:content.slice(0,1500),source:'openai'}:{content:mockReply(text,emotion),source:'fallback'}
  }catch{return {content:mockReply(text,emotion),source:'fallback'}}
}
app.post('/api/chats/:id/messages',auth,chatLimiter,async(req,res)=>{const parsed=z.object({content:z.string().trim().min(1).max(3000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Tin nhắn cần có nội dung và không quá 3.000 ký tự.'});const id=String(req.params.id);const userId=(req as any).userId;let c:Chat|undefined;if(db){const owned=await db.chatSession.findFirst({where:{id,userId}});if(!owned)return res.status(404).json({error:'Không tìm thấy cuộc trò chuyện.'})}else{c=chats.find(x=>x.id===id&&x.userId===userId);if(!c)return res.status(404).json({error:'Không tìm thấy cuộc trò chuyện.'})}const text=parsed.data.content;const emotion=detectEmotion(text);const aiReply=isHighRisk(text)?{content:crisisReply,source:'safety' as const}:await replyFromAI(text,emotion);const response=aiReply.content;if(db){const userMessage=await db.chatMessage.create({data:{sessionId:id,role:'user',content:text,emotion}});const assistantMessage=await db.chatMessage.create({data:{sessionId:id,role:'assistant',content:response,emotion}});return res.json({userMessage,assistantMessage:{...assistantMessage,source:aiReply.source}})}const userMessage={id:randomUUID(),role:'user' as const,content:text,emotion,createdAt:new Date().toISOString()};const assistantMessage={id:randomUUID(),role:'assistant' as const,content:response,emotion,source:aiReply.source,createdAt:new Date().toISOString()};c!.messages.push(userMessage,assistantMessage);if(c!.messages.length===2&&c!.title==='Một cuộc trò chuyện mới')c!.title=text.slice(0,36);res.json({userMessage,assistantMessage})})

app.get('/api/staff/overview',auth,requireStaff,async(_req,res)=>{
  const now=new Date();const weekAgo=new Date(now);weekAgo.setDate(weekAgo.getDate()-6);weekAgo.setHours(0,0,0,0)
  const monthAgo=new Date(now);monthAgo.setDate(monthAgo.getDate()-30)
  if(db){
    const [studentCount,moodCount,chatCount,moodGroups,riskRows]=await Promise.all([
      db.user.count({where:{role:'student'}}),
      db.moodRecord.count({where:{createdAt:{gte:weekAgo}}}),
      db.chatSession.count({where:{createdAt:{gte:weekAgo}}}),
      db.moodRecord.groupBy({by:['mood'],where:{createdAt:{gte:weekAgo}},_count:{_all:true}}),
      db.chatMessage.findMany({where:{role:'user',createdAt:{gte:monthAgo}},select:{id:true,content:true,createdAt:true,session:{select:{id:true,user:{select:{name:true}}}}},orderBy:{createdAt:'desc'},take:1000}),
    ])
    const alerts=riskRows.filter(row=>isHighRisk(row.content)).slice(0,50).map(row=>({id:row.id,studentName:row.session.user.name,content:row.content,createdAt:row.createdAt,chatId:row.session.id}))
    return res.json({studentCount,moodCount,chatCount,moodDistribution:moodGroups.map(row=>({mood:row.mood,count:row._count._all})),alerts,alertWindowDays:30})
  }
  const studentCount=users.filter(user=>user.role==='student').length
  const recentMoods=moods.filter(mood=>new Date(mood.createdAt)>=weekAgo)
  const recentChats=chats.filter(chat=>new Date(chat.createdAt)>=weekAgo)
  const moodDistribution=Object.values(recentMoods.reduce<Record<string,{mood:string;count:number}>>((acc,mood)=>{acc[mood.mood]??={mood:mood.mood,count:0};acc[mood.mood].count++;return acc},{}))
  const alerts=chats.flatMap(chat=>chat.messages.filter(message=>message.role==='user'&&new Date(message.createdAt)>=monthAgo&&isHighRisk(message.content)).map(message=>({id:message.id,studentName:users.find(user=>user.id===chat.userId)?.name||'Học sinh',content:message.content,createdAt:message.createdAt,chatId:chat.id}))).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,50)
  res.json({studentCount,moodCount:recentMoods.length,chatCount:recentChats.length,moodDistribution,alerts,alertWindowDays:30})
})

app.get('/api/dashboard',auth,async(req,res)=>{
  const userId=(req as any).userId;const since=new Date();since.setDate(since.getDate()-6);since.setHours(0,0,0,0)
  const [moodRows,chatRows]=db?await Promise.all([
    db.moodRecord.findMany({where:{userId,createdAt:{gte:since}},orderBy:{createdAt:'desc'}}),
    db.chatSession.findMany({where:{userId},select:{id:true,title:true,createdAt:true},orderBy:{createdAt:'desc'},take:20}),
  ]):[moods.filter(m=>m.userId===userId&&new Date(m.createdAt)>=since),chats.filter(c=>c.userId===userId).map(({id,title,createdAt})=>({id,title,createdAt}))]
  const activities=[...moodRows.map(m=>({id:m.id,type:'mood',label:`Bạn đã chọn “${m.mood}”`,createdAt:m.createdAt})),...chatRows.map(c=>({id:c.id,type:'chat',label:'Một cuộc trò chuyện mới',createdAt:c.createdAt}))].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,5)
  res.json({moods:moodRows,activities,checkInDays:new Set(moodRows.map(m=>new Date(m.createdAt).toLocaleDateString('en-CA'))).size})
})
app.get('/api/moods',auth,async(req,res)=>{const userId=(req as any).userId;if(db)return res.json(await db.moodRecord.findMany({where:{userId},orderBy:{createdAt:'desc'}}));res.json(moods.filter(m=>m.userId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))})
app.post('/api/moods',auth,async(req,res)=>{const parsed=z.object({mood:z.string().trim().min(1).max(32),intensity:z.number().int().min(1).max(5),note:z.string().max(500).optional()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Vui lòng chọn cảm xúc và mức độ từ 1 đến 5.'});const data={...parsed.data,userId:(req as any).userId};if(db){const m=await db.moodRecord.create({data});return res.status(201).json(m)}const m:Mood={id:randomUUID(),...data,createdAt:new Date().toISOString()};moods.push(m);res.status(201).json(m)})
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.status(500).json({error:'Đã có lỗi xảy ra. Vui lòng thử lại sau.'})})
app.listen(port,()=>console.log(`MindSchool API listening on http://localhost:${port}`))
