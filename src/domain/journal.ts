import type { DailyEnergy, DailyMood, EnergyLevel, JournalDraft, JournalEntry, JournalImpact, MoodLevel } from '../types'
import { currentTime, toDateKey } from './task'
import { DEFAULT_TAG_ID } from './preferences'

export const MOODS: { value: MoodLevel; label: string }[] = [
  { value: 1, label: '特别差' },
  { value: 2, label: '有点差' },
  { value: 3, label: '一般' },
  { value: 4, label: '还可以' },
  { value: 5, label: '很高兴' },
]

export const ENERGIES: { value: EnergyLevel; label: string }[] = [
  { value: 1, label: '快没电了' },
  { value: 2, label: '有点疲惫' },
  { value: 3, label: '勉强够用' },
  { value: 4, label: '精力充沛' },
  { value: 5, label: '能量满满' },
]

export const IMPACTS: JournalImpact[] = [-2, -1, 0, 1, 2]

export function emptyJournalDraft(date: Date): JournalDraft {
  return { date: toDateKey(date), hasTime: true, time: currentTime(), title: '', content: '', impact: 0, tagIds: [DEFAULT_TAG_ID], attachments: [] }
}

export function toggleDailyMood(rows: DailyMood[], date: string, level: MoodLevel, updatedAt: string): DailyMood[] {
  const existing = rows.find(row => row.date === date)
  if (existing?.level === level) return rows.filter(row => row.date !== date)
  const next: DailyMood = { date, level, updatedAt }
  return existing ? rows.map(row => row.date === date ? next : row) : [...rows, next]
}

export function toggleDailyEnergy(rows: DailyEnergy[], date: string, level: EnergyLevel, updatedAt: string): DailyEnergy[] {
  const existing = rows.find(row => row.date === date)
  if (existing?.level === level) return rows.filter(row => row.date !== date)
  const next: DailyEnergy = { date, level, updatedAt }
  return existing ? rows.map(row => row.date === date ? next : row) : [...rows, next]
}

export function activeJournalEntries(rows: JournalEntry[]): JournalEntry[] {
  return rows.filter(entry => !entry.trashedAt)
}

export function journalEntriesForDate(rows: JournalEntry[], date: string): JournalEntry[] {
  return rows.filter(entry => !entry.trashedAt && entry.date === date).sort((a, b) => {
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time)
    if (a.time !== b.time) return a.time ? -1 : 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function moodMap(rows: DailyMood[]): Map<string, DailyMood> {
  return new Map(rows.map(row => [row.date, row]))
}

export function energyMap(rows: DailyEnergy[]): Map<string, DailyEnergy> {
  return new Map(rows.map(row => [row.date, row]))
}
