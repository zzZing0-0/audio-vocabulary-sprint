import type { FocusSession, RecurrenceException, Task } from '../types'
import { materializeOccurrence, toDateKey } from './task'


export const COUNTDOWN_MIN_MINUTES = 1
export const COUNTDOWN_MAX_MINUTES = 12 * 60
export const FOCUS_EDIT_MAX_MINUTES = 24 * 60

export function boundedInteger(value: string | number, min: number, max: number, fallback = min) {
  const parsed = typeof value === 'number' ? Math.trunc(value) : Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return Math.min(max, Math.max(min, fallback))
  return Math.min(max, Math.max(min, parsed))
}

export function countdownMinutes(value: string | number, fallback = 15) {
  return boundedInteger(value, COUNTDOWN_MIN_MINUTES, COUNTDOWN_MAX_MINUTES, fallback)
}

export type FocusHistoryRecord = {
  id: string
  kind: 'task' | 'direct'
  title: string
  seconds: number
  tagIds: string[]
  task?: Task
  session?: FocusSession
}

export function activeFocusSession(sessions: FocusSession[]) {
  return sessions.find(session => !session.trashedAt && !session.endedAt) ?? null
}

export function trashFocusSession(session: FocusSession, trashedAt: string) {
  return { ...session, trashedAt, updatedAt: trashedAt }
}

export function restoreFocusSession(session: FocusSession, restoredAt: string) {
  return { ...session, trashedAt: undefined, updatedAt: restoredAt }
}

export function activeFocusSessions(sessions: FocusSession[]) {
  return sessions.filter(session => !session.trashedAt)
}

export function permanentlyDeleteFocusSession(sessions: FocusSession[], id: string) {
  return sessions.filter(session => session.id !== id)
}

export function purgeTrashedFocusSessions(sessions: FocusSession[]) {
  return sessions.filter(session => !session.trashedAt)
}

export function focusTiming(session: FocusSession | null, nowMs: number, maxFocusSeconds: number) {
  if (!session) return { elapsedSeconds: 0, remainingSeconds: 0, dueAtMs: null as number | null }
  const startMs = new Date(session.startedAt).getTime()
  if (!Number.isFinite(startMs)) return { elapsedSeconds: 0, remainingSeconds: 0, dueAtMs: null as number | null }
  const elapsedRaw = Math.max(0, Math.floor((nowMs - startMs) / 1000))
  if (session.mode === 'countdown') {
    const plannedSeconds = Math.max(0, session.plannedSeconds ?? 0)
    return {
      elapsedSeconds: Math.min(plannedSeconds, elapsedRaw),
      remainingSeconds: Math.max(0, plannedSeconds - elapsedRaw),
      dueAtMs: startMs + plannedSeconds * 1000,
    }
  }
  const safeMax = Math.max(0, maxFocusSeconds)
  return {
    elapsedSeconds: Math.min(safeMax, elapsedRaw),
    remainingSeconds: 0,
    dueAtMs: startMs + safeMax * 1000,
  }
}

export function formatFocusClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const h = Math.floor(safe / 3600), m = Math.floor((safe % 3600) / 60), sec = safe % 60
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function finishedFocusSession(session: FocusSession, endMs: number) {
  const startMs = new Date(session.startedAt).getTime()
  const safeEnd = Number.isFinite(startMs) ? Math.max(startMs, endMs) : endMs
  const endedAt = new Date(safeEnd).toISOString()
  const durationSeconds = Number.isFinite(startMs) ? Math.max(0, Math.round((safeEnd - startMs) / 1000)) : 0
  return { ...session, endedAt, durationSeconds, updatedAt: endedAt }
}

export function focusHistoryForDate(tasks: Task[], sessions: FocusSession[], dateKey: string, nowMs: number): FocusHistoryRecord[] {
  const rows: FocusHistoryRecord[] = []
  tasks.forEach(task => {
    if (task.trashedAt) return
    if (!task.recurrence) {
      const seconds = Math.max(0, Number(task.actualDurationMinutes ?? 0) * 60)
      const focusDate = task.date ?? toDateKey(new Date(task.completedAt ?? task.timerSessions?.at(-1)?.endedAt ?? task.updatedAt))
      if (focusDate === dateKey && seconds > 0) rows.push({ id: `task:${task.id}`, kind: 'task', title: task.title, seconds, tagIds: task.tagIds ?? [], task })
      return
    }
    const exception = task.recurrenceExceptions?.[dateKey] as RecurrenceException | undefined
    if (!exception || exception.deleted || exception.trashedAt) return
    const seconds = Math.max(0, Number(exception.actualDurationMinutes ?? 0) * 60)
    if (seconds <= 0) return
    const occurrence = materializeOccurrence(task, dateKey)
    if (occurrence) rows.push({ id: `task:${task.id}:${dateKey}`, kind: 'task', title: occurrence.title, seconds, tagIds: occurrence.tagIds ?? [], task: occurrence })
  })

  const dayStart = new Date(`${dateKey}T00:00:00`).getTime()
  const dayEnd = new Date(`${dateKey}T23:59:59.999`).getTime() + 1
  sessions.forEach(session => {
    if (session.trashedAt) return
    const start = new Date(session.startedAt).getTime()
    if (!Number.isFinite(start)) return
    const rawEnd = session.endedAt ? new Date(session.endedAt).getTime() : nowMs
    const plannedEnd = session.mode === 'countdown' && session.plannedSeconds ? start + session.plannedSeconds * 1000 : rawEnd
    const end = Math.min(rawEnd, plannedEnd)
    const overlap = Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart))
    if (overlap > 0) rows.push({ id: `direct:${session.id}`, kind: 'direct', title: '自由专注', seconds: Math.round(overlap / 1000), tagIds: session.tagIds, session })
  })
  return rows.sort((a, b) => (b.session?.startedAt ?? '').localeCompare(a.session?.startedAt ?? ''))
}
