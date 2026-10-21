import { useEffect, useState } from 'react'
import type { TaskPriority } from '../types'
import { clampMaxFocusHours, parseDefaultPriority } from '../domain/settings'

export { clampMaxFocusHours, parseDefaultPriority } from '../domain/settings'

export type DateFormat = 'dmy' | 'mdy'

export type AppPreferences = {
  greeting: string
  weekStartsMonday: boolean
  dateFormat: DateFormat
  showEndedTasks: boolean
  showAllRecurringTasks: boolean
  excludeDefaultFocusStats: boolean
  maxFocusHours: number
  defaultPriority: TaskPriority
}

export function readAppPreferences(storage: Pick<Storage, 'getItem'>): AppPreferences {
  return {
    greeting: storage.getItem('zing:greeting') || 'Hello, Zing',
    weekStartsMonday: storage.getItem('zing:weekStart') !== 'sunday',
    dateFormat: storage.getItem('zing:dateFormat') === 'mdy' ? 'mdy' : 'dmy',
    showEndedTasks: storage.getItem('zing:showEndedTasks') !== 'false',
    showAllRecurringTasks: storage.getItem('zing:showAllRecurringTasks') !== 'false',
    excludeDefaultFocusStats: storage.getItem('zing:excludeDefaultFocusStats') === 'true',
    maxFocusHours: clampMaxFocusHours(storage.getItem('zing:maxFocusHours')),
    defaultPriority: parseDefaultPriority(storage.getItem('zing:defaultPriority')),
  }
}

export function useAppPreferences() {
  const [initial] = useState(() => readAppPreferences(localStorage))
  const [greeting, setGreeting] = useState(initial.greeting)
  const [weekStartsMonday, setWeekStartsMonday] = useState(initial.weekStartsMonday)
  const [dateFormat, setDateFormat] = useState<DateFormat>(initial.dateFormat)
  const [showEndedTasks, setShowEndedTasks] = useState(initial.showEndedTasks)
  const [showAllRecurringTasks, setShowAllRecurringTasks] = useState(initial.showAllRecurringTasks)
  const [excludeDefaultFocusStats, setExcludeDefaultFocusStats] = useState(initial.excludeDefaultFocusStats)
  const [maxFocusHours, setMaxFocusHours] = useState(initial.maxFocusHours)
  const [defaultPriority, setDefaultPriority] = useState<TaskPriority>(initial.defaultPriority)

  useEffect(() => { localStorage.setItem('zing:greeting', greeting || 'Hello, Zing') }, [greeting])
  useEffect(() => { localStorage.setItem('zing:weekStart', weekStartsMonday ? 'monday' : 'sunday') }, [weekStartsMonday])
  useEffect(() => { localStorage.setItem('zing:dateFormat', dateFormat) }, [dateFormat])
  useEffect(() => { localStorage.setItem('zing:showEndedTasks', String(showEndedTasks)) }, [showEndedTasks])
  useEffect(() => { localStorage.setItem('zing:showAllRecurringTasks', String(showAllRecurringTasks)) }, [showAllRecurringTasks])
  useEffect(() => { localStorage.setItem('zing:excludeDefaultFocusStats', String(excludeDefaultFocusStats)) }, [excludeDefaultFocusStats])
  useEffect(() => { localStorage.setItem('zing:maxFocusHours', String(maxFocusHours)) }, [maxFocusHours])
  useEffect(() => { localStorage.setItem('zing:defaultPriority', String(defaultPriority)) }, [defaultPriority])

  return {
    greeting, setGreeting,
    weekStartsMonday, setWeekStartsMonday,
    dateFormat, setDateFormat,
    showEndedTasks, setShowEndedTasks,
    showAllRecurringTasks, setShowAllRecurringTasks,
    excludeDefaultFocusStats, setExcludeDefaultFocusStats,
    maxFocusHours, setMaxFocusHours,
    defaultPriority, setDefaultPriority,
  }
}
