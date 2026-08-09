// Minimal event bridge so a page (e.g. the mobile lesson flow's "Спросить
// AI" chips) can hand a pre-built question to the existing floating
// AIDrawer without duplicating its chat UI/state or opening the full
// /student/online/ai page. AIDrawer listens for this event and runs the
// prompt through its own machinery.

export const AI_QUICK_ASK_EVENT = 'zhangak:ai-quick-ask'

export interface AIQuickAskDetail {
  text: string
}

export function askAIMentor(text: string): void {
  window.dispatchEvent(new CustomEvent<AIQuickAskDetail>(AI_QUICK_ASK_EVENT, { detail: { text } }))
}
