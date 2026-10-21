import type { EncouragementMessage, EncouragementStyle, EnvironmentOption, SyncedUserSettings, TaskPriority } from '../types'
import { normalizeEnvironmentOptions, DEFAULT_THERMAL_OPTIONS, DEFAULT_WEATHER_OPTIONS } from './preferences'

export type WordClock = { added: Record<string, string>; removed: Record<string, string> }

export function clampMaxFocusHours(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Math.min(12, Math.max(2, Number.isFinite(parsed) ? parsed : 2))
}

export function parseDefaultPriority(value: unknown): TaskPriority {
  const parsed = Number(value)
  return ([0, 1, 2, 3] as number[]).includes(parsed) ? parsed as TaskPriority : 1
}

export function normalizeIgnoredWords(words: string[] | undefined): string[] {
  return [...new Set((words ?? []).map(word => word.trim().toLowerCase()).filter(Boolean))]
}

export function hydrateWordClock(settings: Pick<SyncedUserSettings, 'updatedAt' | 'wordCloudIgnored' | 'wordCloudIgnoredAddedAt' | 'wordCloudIgnoredRemovedAt'>, fallbackStamp: string): WordClock {
  const stamp = settings.updatedAt || fallbackStamp
  const added = { ...(settings.wordCloudIgnoredAddedAt ?? {}) }
  const removed = { ...(settings.wordCloudIgnoredRemovedAt ?? {}) }
  normalizeIgnoredWords(settings.wordCloudIgnored).forEach(word => {
    if (!added[word] && !removed[word]) added[word] = stamp
  })
  return { added, removed }
}

export function advanceWordClock(words: string[], clock: WordClock, now: string): WordClock {
  const wordSet = new Set(normalizeIgnoredWords(words))
  const added = { ...clock.added }
  const removed = { ...clock.removed }
  wordSet.forEach(word => {
    if (!added[word] || (Date.parse(removed[word] || '') || 0) >= (Date.parse(added[word]) || 0)) added[word] = now
  })
  Object.keys(added).forEach(word => {
    if (!wordSet.has(word) && (!removed[word] || (Date.parse(removed[word]) || 0) < (Date.parse(added[word]) || 0))) removed[word] = now
  })
  return { added, removed }
}

type BuildSettingsInput = {
  greeting: string
  weekStartsMonday: boolean
  dateFormat: 'dmy' | 'mdy'
  defaultPriority: TaskPriority
  showEndedTasks: boolean
  showAllRecurringTasks: boolean
  excludeDefaultFocusStats: boolean
  wordCloudIgnored: string[]
  encouragementMessages: EncouragementMessage[]
  encouragementStyle: EncouragementStyle
  maxFocusHours: number
  weatherOptions: EnvironmentOption[]
  thermalOptions: EnvironmentOption[]
}

export function buildSyncedSettings(input: BuildSettingsInput, clock: WordClock, now: string): SyncedUserSettings {
  return {
    id: 'settings', updatedAt: now, greeting: input.greeting || 'Hello, Zing',
    weekStart: input.weekStartsMonday ? 'monday' : 'sunday', dateFormat: input.dateFormat,
    defaultPriority: input.defaultPriority, showEndedTasks: input.showEndedTasks,
    showAllRecurringTasks: input.showAllRecurringTasks, excludeDefaultFocusStats: input.excludeDefaultFocusStats,
    wordCloudIgnored: normalizeIgnoredWords(input.wordCloudIgnored),
    wordCloudIgnoredAddedAt: { ...clock.added }, wordCloudIgnoredRemovedAt: { ...clock.removed },
    encouragementMessages: input.encouragementMessages, encouragementStyle: input.encouragementStyle,
    maxFocusHours: clampMaxFocusHours(input.maxFocusHours), weatherOptions: input.weatherOptions, thermalOptions: input.thermalOptions,
  }
}

export function settingsEqualIgnoringUpdatedAt(previous: SyncedUserSettings | undefined, next: SyncedUserSettings): boolean {
  if (!previous) return false
  return JSON.stringify({ ...previous, updatedAt: '' }) === JSON.stringify({ ...next, updatedAt: '' })
}

export function normalizedIncomingSettings(settings: SyncedUserSettings) {
  return {
    greeting: settings.greeting || 'Hello, Zing',
    weekStartsMonday: settings.weekStart === 'monday',
    dateFormat: settings.dateFormat,
    defaultPriority: settings.defaultPriority,
    showEndedTasks: settings.showEndedTasks,
    showAllRecurringTasks: settings.showAllRecurringTasks,
    excludeDefaultFocusStats: settings.excludeDefaultFocusStats,
    wordCloudIgnored: normalizeIgnoredWords(settings.wordCloudIgnored),
    encouragementMessages: settings.encouragementMessages ?? [],
    encouragementStyle: settings.encouragementStyle ?? 'random' as EncouragementStyle,
    maxFocusHours: clampMaxFocusHours(settings.maxFocusHours ?? 2),
    weatherOptions: normalizeEnvironmentOptions(settings.weatherOptions, DEFAULT_WEATHER_OPTIONS),
    thermalOptions: normalizeEnvironmentOptions(settings.thermalOptions, DEFAULT_THERMAL_OPTIONS),
  }
}
