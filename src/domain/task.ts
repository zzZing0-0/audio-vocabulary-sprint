import type {
  CalendarDay, FocusSession, RecurrenceEnd, RecurrenceRule, Task, TaskDraft, TaskPriority,
} from '../types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DEFAULT_TAG_ID = 'default'
export const RECURRENCE_INTERVAL_MAX = 999
export const RECURRENCE_COUNT_MAX = 9999

export const PRIORITIES: { value: TaskPriority; label: string; hint: string }[] = [
  { value: 0, label: 'P0', hint: '从容' },
  { value: 1, label: 'P1', hint: '普通' },
  { value: 2, label: 'P2', hint: '较高' },
  { value: 3, label: 'P3', hint: '紧急' },
]

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function taskFocusSecondsByDate(tasks: Task[], nowMs: number, includeTagIds: (tagIds?: string[]) => boolean = () => true) {
  const totals = new Map<string, number>()
  const addSeconds = (dateKey: string, seconds: number) => {
    if (!dateKey || !Number.isFinite(seconds) || seconds <= 0) return
    totals.set(dateKey, (totals.get(dateKey) ?? 0) + seconds)
  }
  const addActiveInterval = (startedAt?: string) => {
    if (!startedAt) return
    const startMs = new Date(startedAt).getTime()
    if (!Number.isFinite(startMs) || nowMs <= startMs) return
    let cursor = startMs
    while (cursor < nowMs) {
      const cursorDate = new Date(cursor)
      const nextMidnight = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate() + 1).getTime()
      const segmentEnd = Math.min(nowMs, nextMidnight)
      addSeconds(toDateKey(cursorDate), Math.max(0, Math.round((segmentEnd - cursor) / 1000)))
      cursor = segmentEnd
    }
  }

  tasks.forEach(task => {
    if (task.trashedAt) return
    const isRecurring = Boolean(task.recurrence)
    if (!isRecurring) {
      if (!includeTagIds(task.tagIds)) return
      // actualDurationMinutes is the user's final, editable truth. Timer sessions are
      // intentionally not re-counted here, so a manual correction (30 -> 5 min)
      // immediately changes focus statistics to 5 minutes.
      const focusDate = task.date ?? toDateKey(new Date(task.completedAt ?? task.timerSessions?.at(-1)?.endedAt ?? task.updatedAt))
      addSeconds(focusDate, Math.max(0, Number(task.actualDurationMinutes ?? 0)) * 60)
      addActiveInterval(task.activeTimerStartedAt)
      return
    }

    Object.entries(task.recurrenceExceptions ?? {}).forEach(([occurrenceDate, exception]) => {
      if (task.trashFuture && occurrenceDate >= task.trashFuture.from) return
      if (exception.deleted || exception.trashedAt) return
      if (!includeTagIds(exception.tagIds ?? task.tagIds)) return
      addSeconds(occurrenceDate, Math.max(0, Number(exception.actualDurationMinutes ?? 0)) * 60)
      addActiveInterval(exception.activeTimerStartedAt)
    })
  })
  return totals
}


export function directFocusSecondsByDate(sessions: FocusSession[], nowMs: number, includeTagIds: (tagIds?: string[]) => boolean = () => true) {
  const totals = new Map<string, number>()
  const add = (key:string, seconds:number) => totals.set(key,(totals.get(key)??0)+Math.max(0,seconds))
  sessions.forEach(session => {
    if (session.trashedAt) return
    if (!includeTagIds(session.tagIds)) return
    const start = new Date(session.startedAt).getTime()
    if (!Number.isFinite(start)) return
    const plannedEnd = session.mode==='countdown' && session.plannedSeconds ? start + session.plannedSeconds*1000 : Infinity
    const explicitEnd = session.endedAt ? new Date(session.endedAt).getTime() : nowMs
    const end = Math.min(Number.isFinite(explicitEnd)?explicitEnd:nowMs, plannedEnd)
    if (end<=start) return
    let cursor=start
    while(cursor<end){
      const d=new Date(cursor), midnight=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime()
      const segmentEnd=Math.min(end,midnight)
      add(toDateKey(d),Math.round((segmentEnd-cursor)/1000)); cursor=segmentEnd
    }
  })
  return totals
}

export function combinedFocusSecondsByDate(tasks:Task[], sessions:FocusSession[], nowMs:number, includeTagIds: (tagIds?: string[]) => boolean = () => true){
  const totals=taskFocusSecondsByDate(tasks,nowMs,includeTagIds)
  directFocusSecondsByDate(sessions,nowMs,includeTagIds).forEach((seconds,key)=>totals.set(key,(totals.get(key)??0)+seconds))
  return totals
}
export function normalizedActualDurationMinutes(hoursValue: string | number, minutesValue: string | number) {
  const hours = Math.max(0, Number.parseInt(String(hoursValue || '0'), 10) || 0)
  const minutes = Math.min(59, Math.max(0, Number.parseInt(String(minutesValue || '0'), 10) || 0))
  const total = hours * 60 + minutes
  return total > 0 ? total : undefined
}

export function clearTaskFocusData<T extends Pick<Task, 'actualDurationMinutes' | 'timerSessions' | 'timerSecondsRemainder'>>(task: T): T {
  return { ...task, actualDurationMinutes: 0, timerSessions: [], timerSecondsRemainder: 0 }
}

export function formatActualDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours && rest) return `${hours} 小时 ${rest} 分钟`
  if (hours) return `${hours} 小时`
  return `${rest} 分钟`
}

export function formatFocusDuration(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours && minutes) return `${hours}小时${minutes}分钟`
  if (hours) return `${hours}小时`
  if (minutes) return `${minutes}分钟`
  return seconds > 0 ? '不足1分钟' : '0分钟'
}

export function formatDate(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function ordinalDay(day: number) {
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`
  const suffix = day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'
  return `${day}${suffix}`
}

export function repeatPresetLabels(dateKey: string) {
  const date = fromDateKey(dateKey)
  const weekday = WEEKDAYS[(date.getDay() + 6) % 7]
  return {
    weekly: `每周（${weekday}）`,
    monthly: `每月（${ordinalDay(date.getDate())}）`,
    yearly: `每年（${date.getDate()} ${MONTHS[date.getMonth()]}）`,
  }
}

export function buildMonth(year: number, month: number, weekStartsMonday = true): CalendarDay[] {
  const first = new Date(year, month, 1)
  const offset = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay()
  const gridStart = new Date(year, month, 1 - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return { date, inCurrentMonth: date.getMonth() === month }
  })
}

export function currentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}


export function emptyDraft(date: Date, defaultPriority: TaskPriority = 1): TaskDraft {
  return {
    title: '',
    date: toDateKey(date),
    endDate: '',
    priority: defaultPriority,
    allDay: false,
    time: '',
    deadline: '',
    notes: '',
    actualDurationHours: '',
    actualDurationMinutes: '',
    tagIds: [DEFAULT_TAG_ID],
    attachments: [],
    repeatPreset: 'none',
    repeatInterval: 1,
    repeatUnit: 'week',
    repeatWeekdays: [(date.getDay() + 6) % 7],
    repeatEndMode: 'never',
    repeatEndDate: '',
    repeatEndCount: 20,
  }
}


export function addDaysKey(key: string, days: number) {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function dayDiff(a: string, b: string) {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86400000)
}

export function recurrenceEndFromDraft(draft: TaskDraft): RecurrenceEnd | undefined {
  if (draft.repeatEndMode === 'date' && draft.repeatEndDate) return { type: 'date', date: draft.repeatEndDate }
  if (draft.repeatEndMode === 'count') return { type: 'count', count: Math.min(RECURRENCE_COUNT_MAX, Math.max(1, draft.repeatEndCount || 1)) }
  return undefined
}

export function recurrenceFromDraft(draft: TaskDraft): RecurrenceRule | undefined {
  if (!draft.date || draft.repeatPreset === 'none') return undefined
  const end = recurrenceEndFromDraft(draft)
  if (draft.repeatPreset === 'daily') return { unit: 'day', interval: 1, end }
  if (draft.repeatPreset === 'weekly') return { unit: 'week', interval: 1, weekdays: [(fromDateKey(draft.date).getDay() + 6) % 7], end }
  if (draft.repeatPreset === 'monthly') return { unit: 'month', interval: 1, end }
  if (draft.repeatPreset === 'yearly') return { unit: 'year', interval: 1, end }
  return { unit: draft.repeatUnit, interval: Math.min(RECURRENCE_INTERVAL_MAX, Math.max(1, draft.repeatInterval || 1)), weekdays: draft.repeatUnit === 'week' ? (draft.repeatWeekdays.length ? [...draft.repeatWeekdays].sort() : [(fromDateKey(draft.date).getDay() + 6) % 7]) : undefined, end }
}

export function repeatEndDraft(rule?: RecurrenceRule): Pick<TaskDraft, 'repeatEndMode' | 'repeatEndDate' | 'repeatEndCount'> {
  if (!rule?.end) return { repeatEndMode: 'never', repeatEndDate: '', repeatEndCount: 20 }
  if (rule.end.type === 'date') return { repeatEndMode: 'date', repeatEndDate: rule.end.date, repeatEndCount: 20 }
  return { repeatEndMode: 'count', repeatEndDate: '', repeatEndCount: rule.end.count }
}

export function draftRepeat(task: Task): Pick<TaskDraft, 'repeatPreset' | 'repeatInterval' | 'repeatUnit' | 'repeatWeekdays' | 'repeatEndMode' | 'repeatEndDate' | 'repeatEndCount'> {
  const rule = task.recurrence
  const ending = repeatEndDraft(rule)
  if (!rule) return { repeatPreset: 'none', repeatInterval: 1, repeatUnit: 'week', repeatWeekdays: [], ...ending }
  if (rule.interval === 1 && rule.unit === 'day') return { repeatPreset: 'daily', repeatInterval: 1, repeatUnit: 'day', repeatWeekdays: [], ...ending }
  if (rule.interval === 1 && rule.unit === 'week' && (rule.weekdays?.length ?? 0) === 1) return { repeatPreset: 'weekly', repeatInterval: 1, repeatUnit: 'week', repeatWeekdays: rule.weekdays ?? [], ...ending }
  if (rule.interval === 1 && rule.unit === 'month') return { repeatPreset: 'monthly', repeatInterval: 1, repeatUnit: 'month', repeatWeekdays: [], ...ending }
  if (rule.interval === 1 && rule.unit === 'year') return { repeatPreset: 'yearly', repeatInterval: 1, repeatUnit: 'year', repeatWeekdays: [], ...ending }
  return { repeatPreset: 'custom', repeatInterval: rule.interval, repeatUnit: rule.unit, repeatWeekdays: rule.weekdays ?? [], ...ending }
}

export function isScheduledTask(task: Task): task is Task & { date: string } { return Boolean(task.date) }

export function normalizeTaskScheduling(task: Task): Task {
  if (task.date) return task
  return { ...task, date: null, endDate: undefined, time: undefined, recurrence: undefined, recurrenceExceptions: undefined, originalDate: undefined }
}

export function baseOccursOn(task: Task, key: string) {
  if (!task.date) return false
  const rule = task.recurrence
  if (!rule || key < task.date) return key === task.date
  const anchor = fromDateKey(task.date)
  const date = fromDateKey(key)
  if (rule.unit === 'day') return dayDiff(task.date, key) % rule.interval === 0
  if (rule.unit === 'week') {
    const weeks = Math.floor(dayDiff(task.date, key) / 7)
    const weekday = (date.getDay() + 6) % 7
    return weeks % rule.interval === 0 && (rule.weekdays?.length ? rule.weekdays.includes(weekday) : weekday === (anchor.getDay() + 6) % 7)
  }
  if (rule.unit === 'month') {
    const months = (date.getFullYear() - anchor.getFullYear()) * 12 + date.getMonth() - anchor.getMonth()
    return months >= 0 && months % rule.interval === 0 && date.getDate() === anchor.getDate()
  }
  const years = date.getFullYear() - anchor.getFullYear()
  return years >= 0 && years % rule.interval === 0 && date.getMonth() === anchor.getMonth() && date.getDate() === anchor.getDate()
}

export function occurrenceNumber(task: Task, key: string) {
  if (!task.date) return 0
  let count = 0
  let cursor = fromDateKey(task.date)
  const target = fromDateKey(key)
  while (cursor <= target) {
    if (baseOccursOn(task, toDateKey(cursor))) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function occursOn(task: Task, key: string) {
  const rule = task.recurrence
  if (!baseOccursOn(task, key)) return false
  if (!rule?.end) return true
  if (rule.end.type === 'date') return key <= rule.end.date
  return occurrenceNumber(task, key) <= rule.end.count
}

export function secondOccurrenceDate(task: Task): string | null {
  if (!task.date || !task.recurrence) return null
  let cursor = fromDateKey(task.date)
  // Search far enough for yearly/custom yearly rules while respecting recurrence end.
  const limit = new Date(cursor)
  limit.setFullYear(limit.getFullYear() + 20)
  let seen = 0
  while (cursor <= limit) {
    const key = toDateKey(cursor)
    if (occursOn(task, key)) {
      seen += 1
      if (seen === 2) return key
    }
    // A date-ended rule cannot produce anything after its end date.
    if (task.recurrence.end?.type === 'date' && key >= task.recurrence.end.date) break
    // A count-ended rule with count <= 1 is necessarily a single occurrence.
    if (task.recurrence.end?.type === 'count' && task.recurrence.end.count <= 1) break
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}

export function normalizeSingleOccurrenceSeries(task: Task): Task {
  task = normalizeTaskScheduling(task)
  if (!task.recurrence || secondOccurrenceDate(task)) return task
  const first = task.date ? task.recurrenceExceptions?.[task.date] : undefined
  return {
    ...task,
    ...(first ?? {}),
    id: task.id,
    seriesId: undefined,
    occurrenceDate: undefined,
    recurrence: undefined,
    recurrenceExceptions: undefined,
  }
}

export function materializeOccurrence(series: Task, occurrenceDate: string): Task | null {
  if (!series.date || series.trashedAt || (series.trashFuture && occurrenceDate >= series.trashFuture.from)) return null
  const exception = series.recurrenceExceptions?.[occurrenceDate]
  if (exception?.deleted || exception?.trashedAt) return null
  const duration = dayDiff(series.date, taskEndDate(series))
  const base: Task = {
    ...series,
    id: `${series.id}::${occurrenceDate}`,
    seriesId: series.id,
    occurrenceDate,
    date: occurrenceDate,
    endDate: duration > 0 ? addDaysKey(occurrenceDate, duration) : undefined,
  }
  return exception ? { ...base, ...exception, id: base.id, seriesId: series.id, occurrenceDate } : base
}

export function expandTasks(tasks: Task[], startKey: string, endKey: string) {
  const result: Task[] = []
  tasks.forEach(task => {
    if (task.trashedAt || !task.date) return
    if (!task.recurrence) {
      if (task.date <= endKey && taskEndDate(task) >= startKey) result.push(task)
      return
    }
    const duration = dayDiff(task.date, taskEndDate(task))
    let cursor = fromDateKey(addDaysKey(startKey, -Math.max(0, duration)))
    const end = fromDateKey(endKey)
    while (cursor <= end) {
      const key = toDateKey(cursor)
      if (occursOn(task, key)) {
        const occurrence = materializeOccurrence(task, key)
        if (occurrence?.date && occurrence.date <= endKey && taskEndDate(occurrence) >= startKey) result.push(occurrence)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  })
  return result
}

export function isNextPendingRecurringOccurrence(occurrence: Task, seriesTasks: Task[]) {
  if (occurrence.status !== 'todo' || !occurrence.seriesId || !occurrence.occurrenceDate) return true
  const series = seriesTasks.find(task => task.id === occurrence.seriesId)
  if (!series?.date || !series.recurrence) return true

  const targetKey = occurrence.occurrenceDate
  let cursor = fromDateKey(series.date)
  const target = fromDateKey(targetKey)
  while (cursor <= target) {
    const key = toDateKey(cursor)
    if (occursOn(series, key)) {
      const candidate = materializeOccurrence(series, key)
      if (candidate?.status === 'todo') return key === targetKey
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return true
}

export function applyRecurringDisplayMode(expanded: Task[], seriesTasks: Task[], showAllRecurringTasks: boolean) {
  if (showAllRecurringTasks) return expanded
  return expanded.filter(task => isNextPendingRecurringOccurrence(task, seriesTasks))
}


export function taskSort(a: Task, b: Task) {
  const statusRank = (task: Task) => task.status === 'todo' ? 0 : task.status === 'completed' ? 1 : 2
  const statusDifference = statusRank(a) - statusRank(b)
  if (statusDifference !== 0) return statusDifference

  const aHasTime = !a.allDay && Boolean(a.time)
  const bHasTime = !b.allDay && Boolean(b.time)
  if (aHasTime !== bHasTime) return aHasTime ? -1 : 1
  if (aHasTime && bHasTime && a.time !== b.time) return (a.time ?? '').localeCompare(b.time ?? '')
  if (a.priority !== b.priority) return b.priority - a.priority

  return a.createdAt.localeCompare(b.createdAt)
}

export function formatTaskRange(task: Task) {
  if (!task.date) return '收集箱'
  const start = fromDateKey(task.date)
  const end = fromDateKey(taskEndDate(task))
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]}`
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
}

export function deadlineStage(task: Task, now = new Date()) {
  if (!task.deadline || task.status !== 'todo') return 'deadline-normal'
  const created = new Date(task.createdAt)
  const deadline = fromDateKey(task.deadline)
  deadline.setHours(23, 59, 59, 999)

  if (now > deadline) return 'deadline-overdue'
  const total = deadline.getTime() - created.getTime()
  if (total <= 0) return 'deadline-overdue'
  const progress = (now.getTime() - created.getTime()) / total
  if (progress >= 0.75) return 'deadline-red'
  if (progress >= 0.5) return 'deadline-yellow'
  return 'deadline-normal'
}
 
export function isTaskOverdue(task: Task, todayKey = toDateKey(new Date())) {
  return Boolean(task.date) && task.status === 'todo' && taskEndDate(task) < todayKey
}


export function compactCount(count: number) {
  return count > 99 ? '99+' : String(count)
}

export function taskEndDate(task: Task) { return task.endDate || task.date || '' }
export function taskCoversDate(task: Task, key: string) { return Boolean(task.date) && task.date! <= key && taskEndDate(task) >= key }
export function isMultiDayTask(task: Task) { return Boolean(task.date) && taskEndDate(task) > task.date! }

export type MultiDaySegment = { task: Task; week: number; startColumn: number; span: number; lane: number }

export function buildMultiDaySegments(tasks: Task[], days: CalendarDay[]): MultiDaySegment[] {
  const segments: MultiDaySegment[] = []
  const weekCount = Math.ceil(days.length / 7)
  for (let week = 0; week < weekCount; week += 1) {
    const weekDays = days.slice(week * 7, week * 7 + 7)
    if (weekDays.length === 0) continue
    const weekStart = toDateKey(weekDays[0].date)
    const weekEnd = toDateKey(weekDays[weekDays.length - 1].date)
    const candidates = tasks
      .filter((task): task is Task & { date: string } => {
        if (!task.date) return false
        return isMultiDayTask(task) && task.date <= weekEnd && taskEndDate(task) >= weekStart
      })
      .sort((a, b) => a.date.localeCompare(b.date) || taskEndDate(b).localeCompare(taskEndDate(a)) || b.priority - a.priority)
    const lanes: { start:number; end:number }[][] = []
    candidates.forEach(task => {
      const clippedStart = task.date < weekStart ? weekStart : task.date
      const clippedEnd = taskEndDate(task) > weekEnd ? weekEnd : taskEndDate(task)
      const startColumn = weekDays.findIndex(day => toDateKey(day.date) === clippedStart)
      const endColumn = weekDays.findIndex(day => toDateKey(day.date) === clippedEnd)
      if (startColumn < 0 || endColumn < 0) return
      let lane = 0
      while ((lanes[lane] ?? []).some(item => !(endColumn < item.start || startColumn > item.end))) lane += 1
      if (!lanes[lane]) lanes[lane] = []
      lanes[lane].push({ start:startColumn, end:endColumn })
      segments.push({ task, week, startColumn, span:endColumn-startColumn+1, lane })
    })
  }
  return segments
}

