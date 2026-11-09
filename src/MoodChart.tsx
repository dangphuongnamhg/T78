import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

type DayPoint = { day: string; dateLabel: string; value: number | null; count: number; key: string }

export default function MoodChart({ data }: { data: DayPoint[] }) {
  return <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ left: -22, right: 4, top: 16, bottom: 0 }}>
      <defs><linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9788ec" stopOpacity={0.19}/><stop offset="95%" stopColor="#9788ec" stopOpacity={0.015}/></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="#ececf4" strokeDasharray="4 5"/>
      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#9d9bb0', fontSize: 11 }} dy={9}/>
      <Tooltip contentStyle={{ border: '1px solid #eeeaf9', borderRadius: 12, fontSize: 12 }} formatter={(value) => [`${value}/5`, 'Tâm trạng']} labelFormatter={(_label, payload) => payload?.[0]?.payload?.dateLabel || _label}/>
      <Area type="monotone" dataKey="value" stroke="#8c7fe3" strokeWidth={2.5} fill="url(#moodFill)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} connectNulls={false}/>
    </AreaChart>
  </ResponsiveContainer>
}
