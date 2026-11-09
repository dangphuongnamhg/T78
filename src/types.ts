export type Mood = { id: string; mood: string; intensity: number; note?: string; createdAt: string }
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; emotion?: string; source?: 'openai' | 'mock' | 'fallback' | 'safety'; createdAt: string }
export type Session = { id: string; title: string; createdAt: string }
export type User = { id: string; name: string; email: string; role?: 'student' | 'teacher' | 'admin' }
export type DashboardActivity = { id: string; type: 'chat' | 'mood'; label: string; createdAt: string }
