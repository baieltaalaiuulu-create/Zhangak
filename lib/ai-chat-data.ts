import { supabase } from '@/lib/supabase'

// AI Mentor chat history — ai_chat_sessions/ai_chat_messages, RLS disabled
// (same convention as practice_tests/questions/announcements/universities),
// so reads and writes both go straight through the anon-key client here.

export interface ChatSession {
  id: string
  student_id: string
  title: string | null
  is_pinned: boolean
  created_at: string
}

export interface ChatMessageRow {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  message_type: string
  created_at: string
}

export async function fetchChatSessions(studentId: string): Promise<ChatSession[]> {
  const { data } = await supabase
    .from('ai_chat_sessions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  return (data ?? []) as ChatSession[]
}

export async function createChatSession(studentId: string, title: string): Promise<ChatSession> {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .insert({ student_id: studentId, title })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Не удалось создать беседу')
  return data as ChatSession
}

export async function renameChatSession(id: string, title: string): Promise<void> {
  await supabase.from('ai_chat_sessions').update({ title }).eq('id', id)
}

export async function togglePinSession(id: string, pinned: boolean): Promise<void> {
  await supabase.from('ai_chat_sessions').update({ is_pinned: pinned }).eq('id', id)
}

export async function deleteChatSession(id: string): Promise<void> {
  await supabase.from('ai_chat_sessions').delete().eq('id', id)
}

export async function fetchChatMessages(sessionId: string): Promise<ChatMessageRow[]> {
  const { data } = await supabase
    .from('ai_chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  return (data ?? []) as ChatMessageRow[]
}

export async function saveChatMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  messageType = 'text',
): Promise<void> {
  await supabase.from('ai_chat_messages').insert({ session_id: sessionId, role, content, message_type: messageType })
}

// A short title derived from the first user message — same idea as most
// chat UIs ("New chat" renames itself once you actually say something).
export function deriveSessionTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, ' ')
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed || 'Новая беседа'
}
