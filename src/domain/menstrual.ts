import type { MenstrualDayLog, MenstrualPeriod } from '../types'
import { addDaysKey, dayDiff } from './task'

export type MenstrualPrediction = {
  start: string
  end: string
  windowStart: string
  windowEnd: string
  averageCycle: number
}

export function calculateMenstrualPrediction(periods: MenstrualPeriod[]): MenstrualPrediction | null {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const latest = sorted.at(-1)
  if (!latest || sorted.length < 3) return null

  const intervals = sorted
    .slice(1)
    .map((row, index) => dayDiff(sorted[index].startDate, row.startDate))
    .filter(days => days >= 15 && days <= 60)
  if (intervals.length < 2) return null

  const recentIntervals = intervals.slice(-6)
  const averageCycle = Math.round(recentIntervals.reduce((sum, days) => sum + days, 0) / recentIntervals.length)
  const start = addDaysKey(latest.startDate, averageCycle)

  const durations = sorted
    .filter(period => period.endDate)
    .map(period => dayDiff(period.startDate, period.endDate!) + 1)
    .filter(days => days >= 1 && days <= 10)
  const recentDurations = durations.slice(-6)
  const duration = recentDurations.length
    ? Math.round(recentDurations.reduce((sum, days) => sum + days, 0) / recentDurations.length)
    : 5

  return {
    start,
    end: addDaysKey(start, Math.max(0, duration - 1)),
    windowStart: addDaysKey(start, -1),
    windowEnd: addDaysKey(start, 1),
    averageCycle,
  }
}

export function menstrualVisualForDate(
  key: string,
  periods: MenstrualPeriod[],
  prediction: MenstrualPrediction | null,
): '' | 'actual' | 'predicted' {
  const actual = periods.some(period =>
    period.endDate ? key >= period.startDate && key <= period.endDate : key === period.startDate,
  )
  if (actual) return 'actual'
  if (prediction && key >= prediction.windowStart && key <= prediction.windowEnd) return 'predicted'
  return ''
}

export function periodForDate(periods: MenstrualPeriod[], key: string, todayKey: string): MenstrualPeriod | undefined {
  return periods.find(period => key >= period.startDate && key <= (period.endDate ?? todayKey))
}

export function patchPeriodDayLog(period: MenstrualPeriod, date: string, patch: Partial<MenstrualDayLog>): MenstrualPeriod {
  const existing = period.dayLogs.find(log => log.date === date) ?? { date }
  const next = { ...existing, ...patch }
  return { ...period, dayLogs: [...period.dayLogs.filter(log => log.date !== date), next] }
}
