'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, LoaderCircle, RefreshCw, Save, Sparkles, Trophy } from 'lucide-react'
import { useRouter } from 'next/navigation'

import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  getAdminGamificationDefinitions,
  scheduleAdminQuestConfiguration,
  updateAdminAchievementDefinition,
  type AdminAchievementDefinition,
  type AdminGamificationDefinitions,
  type AdminQuestDefinition,
} from '@/lib/admin-gamification-client'
import { getCurrentZhangakUser } from '@/lib/zhangak-auth-client'

interface QuestDraft {
  targetCount: string
  xpReward: string
  isActive: boolean
}

interface AchievementDraft {
  sortOrder: string
  isActive: boolean
}

const EVENT_LABELS: Record<AdminQuestDefinition['targetEventType'], string> = {
  platform_visit: 'вход на платформу',
  lesson_completed: 'завершённый урок',
  practice_submitted: 'сданный тест',
  daily_challenge_completed: 'задание дня',
  trainer_mastered: 'новый освоенный вопрос',
  daily_quest_completed: 'выполненный квест дня',
  weekly_quest_completed: 'выполненный квест недели',
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'Asia/Bishkek' }).format(new Date(`${value}T00:00:00+06:00`))
}

function questDraft(quest: AdminQuestDefinition): QuestDraft {
  const source = quest.scheduled ?? quest.current
  return { targetCount: String(source.targetCount), xpReward: String(source.xpReward), isActive: source.isActive }
}

function achievementDraft(achievement: AdminAchievementDefinition): AchievementDraft {
  return { sortOrder: String(achievement.sortOrder), isActive: achievement.isActive }
}

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

export default function AdminGamificationPage() {
  const router = useRouter()
  const [definitions, setDefinitions] = useState<AdminGamificationDefinitions | null>(null)
  const [questDrafts, setQuestDrafts] = useState<Record<number, QuestDraft>>({})
  const [achievementDrafts, setAchievementDrafts] = useState<Record<number, AchievementDraft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const user = await getCurrentZhangakUser()
      if (!user) { router.replace('/login'); return }
      if (user.role !== 'admin' && user.role !== 'super_admin') { router.replace('/admin'); return }
      const result = await getAdminGamificationDefinitions()
      setDefinitions(result)
      setQuestDrafts(Object.fromEntries(result.quests.map(item => [item.id, questDraft(item)])))
      setAchievementDrafts(Object.fromEntries(result.achievements.map(item => [item.id, achievementDraft(item)])))
    } catch (cause) {
      setError(message(cause, 'Не удалось загрузить настройки геймификации'))
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const saveQuest = async (quest: AdminQuestDefinition) => {
    const draft = questDrafts[quest.id]
    if (!draft) return
    setSaving(quest.id); setError(''); setSuccess('')
    try {
      const updated = await scheduleAdminQuestConfiguration(quest.id, {
        targetCount: Number(draft.targetCount), xpReward: Number(draft.xpReward), isActive: draft.isActive,
      })
      setDefinitions(current => current ? { ...current, quests: current.quests.map(item => item.id === updated.id ? updated : item) } : current)
      setQuestDrafts(current => ({ ...current, [updated.id]: questDraft(updated) }))
      setSuccess(`Настройка «${updated.title}» сохранена для следующего ${updated.period === 'daily' ? 'дня' : 'понедельника'}.`)
    } catch (cause) {
      setError(message(cause, 'Не удалось запланировать изменения квеста'))
    } finally {
      setSaving(null)
    }
  }

  const saveAchievement = async (achievement: AdminAchievementDefinition) => {
    const draft = achievementDrafts[achievement.id]
    if (!draft) return
    setSaving(achievement.id); setError(''); setSuccess('')
    try {
      const updated = await updateAdminAchievementDefinition(achievement.id, { sortOrder: Number(draft.sortOrder), isActive: draft.isActive })
      setDefinitions(current => current ? { ...current, achievements: current.achievements.map(item => item.id === updated.id ? updated : item) } : current)
      setSuccess(`Настройка достижения «${updated.title}» сохранена.`)
    } catch (cause) {
      setError(message(cause, 'Не удалось обновить достижение'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Квесты и достижения" actionLabel="Обновить" actionIcon={RefreshCw} onAction={() => void load()} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-2xl bg-[#0D1E4A] p-5 text-white shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><Sparkles size={22} aria-hidden="true" /></span>
              <h1 className="mt-4 text-xl font-black">Экономика обучения</h1>
              <p className="mt-2 text-sm leading-6 text-blue-100">XP и прогресс никогда не редактируются вручную. Изменение квеста создаёт версию для следующего дня или недели; открытые квесты учеников сохраняют прежние правила.</p>
            </div>
            <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold"><CalendarClock size={17} aria-hidden="true" />Asia/Bishkek</span>
          </div>
        </section>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p>}

        {loading || !definitions ? (
          <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm font-semibold text-slate-500"><LoaderCircle size={19} className="animate-spin" aria-hidden="true" />Загружаем правила…</div>
        ) : (
          <>
            <section aria-labelledby="quests-heading">
              <div className="mb-3"><h2 id="quests-heading" className="text-lg font-black text-[#191B23]">Квесты</h2><p className="mt-1 text-sm text-slate-500">Условия формируются только из подтверждённых событий собственного backend.</p></div>
              <div className="grid gap-4 xl:grid-cols-2">
                {definitions.quests.map(quest => {
                  const draft = questDrafts[quest.id] ?? questDraft(quest)
                  const effective = quest.scheduled?.effectiveFrom ?? (quest.period === 'daily' ? 'следующего дня' : 'следующего понедельника')
                  return <article key={quest.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-[#1B3F92]">{quest.period === 'daily' ? 'Каждый день' : 'Каждую неделю'}</span><h3 className="mt-3 font-black text-[#0D1E4A]">{quest.title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{quest.description}</p></div>
                      <span className={draft.isActive ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600'}>{draft.isActive ? 'Включён' : 'Выключен'}</span>
                    </div>
                    <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Событие: {EVENT_LABELS[quest.targetEventType]}. Сейчас: {quest.current.targetCount} × {quest.current.xpReward} XP.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-bold text-slate-700">Цель<input type="number" min="1" max="1000" value={draft.targetCount} onChange={event => setQuestDrafts(current => ({ ...current, [quest.id]: { ...draft, targetCount: event.target.value } }))} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
                      <label className="text-sm font-bold text-slate-700">Награда XP<input type="number" min="1" max="10000" value={draft.xpReward} onChange={event => setQuestDrafts(current => ({ ...current, [quest.id]: { ...draft, xpReward: event.target.value } }))} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
                    </div>
                    <label className="mt-4 flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={draft.isActive} onChange={event => setQuestDrafts(current => ({ ...current, [quest.id]: { ...draft, isActive: event.target.checked } }))} className="h-4 w-4" />Включить в следующий период</label>
                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-500">{quest.scheduled ? `Запланировано с ${dateLabel(effective)}.` : `Изменение начнёт действовать с ${effective}.`}</p><button type="button" onClick={() => void saveQuest(quest)} disabled={saving === quest.id} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white disabled:opacity-50"><Save size={16} aria-hidden="true" />{saving === quest.id ? 'Сохраняем…' : 'Запланировать'}</button></div>
                  </article>
                })}
              </div>
            </section>

            <section aria-labelledby="achievements-heading">
              <div className="mb-3"><h2 id="achievements-heading" className="text-lg font-black text-[#191B23]">Достижения</h2><p className="mt-1 text-sm text-slate-500">Они выдаются автоматически один раз. Здесь доступно только включение новых выдач и порядок отображения.</p></div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {definitions.achievements.map(achievement => {
                  const draft = achievementDrafts[achievement.id] ?? achievementDraft(achievement)
                  return <article key={achievement.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Trophy size={19} aria-hidden="true" /></span><div className="min-w-0"><h3 className="font-extrabold text-[#0D1E4A]">{achievement.title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{achievement.description}</p></div></div><div className="mt-4 flex items-end gap-3"><label className="min-w-0 flex-1 text-xs font-bold text-slate-600">Порядок<input type="number" min="0" max="10000" value={draft.sortOrder} onChange={event => setAchievementDrafts(current => ({ ...current, [achievement.id]: { ...draft, sortOrder: event.target.value } }))} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={draft.isActive} onChange={event => setAchievementDrafts(current => ({ ...current, [achievement.id]: { ...draft, isActive: event.target.checked } }))} className="h-4 w-4" />Активно</label></div><button type="button" onClick={() => void saveAchievement(achievement)} disabled={saving === achievement.id} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#1B3F92] px-4 text-sm font-bold text-[#1B3F92] hover:bg-blue-50 disabled:opacity-50"><CheckCircle2 size={16} aria-hidden="true" />{saving === achievement.id ? 'Сохраняем…' : 'Сохранить'}</button></article>
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
