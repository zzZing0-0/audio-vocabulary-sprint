export type TaskPriority = 0 | 1 | 2 | 3
export type TaskStatus = 'todo' | 'completed' | 'abandoned'
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'
export type RecurrenceEnd = { type: 'date'; date: string } | { type: 'count'; count: number }
export type RecurrenceRule = { unit: RecurrenceUnit; interval: number; weekdays?: number[]; end?: RecurrenceEnd }
export type PostponeEvent = { from: string; to: string; at: string }
export type Attachment = { id: string; type: 'image' | 'audio'; filename: string; mimeType: string; size: number; storageKey: string; createdAt: string; duration?: number }
export type TimerSession = { startedAt: string; endedAt: string; durationSeconds: number }
export type FocusSession = { id:string; tagIds:string[]; mode:'stopwatch'|'countdown'; plannedSeconds?:number; startedAt:string; endedAt?:string; durationSeconds?:number; createdAt:string; updatedAt:string; trashedAt?:string }
export type RecurrenceException = { deleted?: boolean; trashedAt?: string; status?: TaskStatus; completedAt?: string; title?: string; date?: string; endDate?: string; priority?: TaskPriority; allDay?: boolean; time?: string; deadline?: string; notes?: string; actualDurationMinutes?: number; activeTimerStartedAt?: string; timerSessions?: TimerSession[]; timerSecondsRemainder?: number; tagIds?: string[]; postponeHistory?: PostponeEvent[]; attachments?: Attachment[]; updatedAt: string }

export type CalendarDay = {
  date: Date
  inCurrentMonth: boolean
}

export type AttachmentLinkTombstones = Record<string, string>

export type Task = {
  id: string
  title: string
  date: string | null
  endDate?: string
  priority: TaskPriority
  status: TaskStatus
  allDay: boolean
  time?: string
  deadline?: string
  notes?: string
  actualDurationMinutes?: number
  activeTimerStartedAt?: string
  timerSessions?: TimerSession[]
  timerSecondsRemainder?: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  originalDate?: string
  postponeHistory?: PostponeEvent[]
  attachments?: Attachment[]
  attachmentLinkTombstones?: AttachmentLinkTombstones
  tagIds?: string[]
  recurrence?: RecurrenceRule
  recurrenceExceptions?: Record<string, RecurrenceException>
  seriesId?: string
  occurrenceDate?: string
  trashedAt?: string
  trashFuture?: { from: string; trashedAt: string }
}

export type MoodLevel = 1 | 2 | 3 | 4 | 5
export type JournalImpact = -2 | -1 | 0 | 1 | 2

export type DailyMood = {
  date: string
  level: MoodLevel
  updatedAt: string
}

export type EnergyLevel = 1 | 2 | 3 | 4 | 5
export type DailyEnergy = {
  date: string
  level: EnergyLevel
  updatedAt: string
}
export type EnvironmentOption = {
  id: string
  name: string
  emoji?: string
  order: number
  builtin?: boolean
  archived?: boolean
  updatedAt: string
  deletedAt?: string
}
export type DailyEnvironment = {
  date: string
  weatherOptionId?: string
  thermalOptionId?: string
  locationCity?: string
  locationCountry?: string
  updatedAt: string
}
export type MenstrualDayLog = {
  date: string
  notes?: string
}
export type MenstrualPeriod = {
  id: string
  startDate: string
  endDate?: string
  dayLogs: MenstrualDayLog[]
  createdAt: string
  updatedAt: string
}

export type JournalEntry = {
  id: string
  date: string
  time?: string
  title: string
  content: string
  impact: JournalImpact
  createdAt: string
  updatedAt: string
  tagIds?: string[]
  attachments?: Attachment[]
  attachmentLinkTombstones?: AttachmentLinkTombstones
  trashedAt?: string
}

export type AnniversaryType = 'birthday' | 'anniversary' | 'important' | 'other'
export type AnniversaryCalendar = 'solar' | 'lunar'
export type Anniversary = {
  id: string
  title: string
  type: AnniversaryType
  calendar: AnniversaryCalendar
  year?: number
  month: number
  day: number
  isLeapMonth?: boolean
  repeatYearly: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  trashedAt?: string
}
export type AnniversaryDraft = {
  title: string
  type: AnniversaryType
  calendar: AnniversaryCalendar
  year: string
  month: number
  day: number
  isLeapMonth: boolean
  repeatYearly: boolean
  notes: string
}

export type TagScope = 'task' | 'journal' | 'both'
export type Tag = { id: string; name: string; color: string; scope: TagScope; sortOrder?: number; archived?: boolean; archivedAt?: string; system?: boolean; systemKind?: 'default' | 'import-source'; sourceKey?: string; updatedAt: string }

export type JournalDraft = {
  date: string
  hasTime: boolean
  time: string
  title: string
  content: string
  impact: JournalImpact
  tagIds: string[]
  attachments: Attachment[]
}

export type TaskDraft = {
  title: string
  date: string
  endDate: string
  priority: TaskPriority
  allDay: boolean
  time: string
  deadline: string
  notes: string
  actualDurationHours: string
  actualDurationMinutes: string
  tagIds: string[]
  attachments: Attachment[]
  repeatPreset: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  repeatInterval: number
  repeatUnit: RecurrenceUnit
  repeatWeekdays: number[]
  repeatEndMode: 'never' | 'date' | 'count'
  repeatEndDate: string
  repeatEndCount: number
}



export type EncouragementMessage = {
  id: string
  text: string
  updatedAt: string
  deletedAt?: string
}

export type EncouragementStyle = 'dark' | 'light' | 'random'

export type SyncedUserSettings = {
  id: 'settings'
  updatedAt: string
  greeting: string
  weekStart: 'monday' | 'sunday'
  dateFormat: 'dmy' | 'mdy'
  defaultPriority: TaskPriority
  showEndedTasks: boolean
  showAllRecurringTasks: boolean
  excludeDefaultFocusStats: boolean
  wordCloudIgnored: string[]
  wordCloudIgnoredAddedAt?: Record<string, string>
  wordCloudIgnoredRemovedAt?: Record<string, string>
  encouragementMessages?: EncouragementMessage[]
  encouragementStyle?: EncouragementStyle
  maxFocusHours?: number
  weatherOptions?: EnvironmentOption[]
  thermalOptions?: EnvironmentOption[]
}

export type BackupPreview = {
  file: File
  manifest: any
  tasks: Task[]
  journals: JournalEntry[]
  moods: DailyMood[]
  energies: DailyEnergy[]
  environments: DailyEnvironment[]
  periods: MenstrualPeriod[]
  tags: Tag[]
  anniversaries: Anniversary[]
  focusSessions: FocusSession[]
  settings: {
    greeting?: string
    weekStart?: 'monday' | 'sunday'
    dateFormat?: 'dmy' | 'mdy'
    defaultPriority?: TaskPriority
    showEndedTasks?: boolean
    showAllRecurringTasks?: boolean
    excludeDefaultFocusStats?: boolean
    wordCloudIgnored?: string[]
    encouragementMessages?: EncouragementMessage[]
    encouragementStyle?: EncouragementStyle
    maxFocusHours?: number
    weatherOptions?: EnvironmentOption[]
    thermalOptions?: EnvironmentOption[]
  }
  attachments: {
    storageKey: string
    path: string
    filename: string
    mimeType: string
    size: number
    type: 'image' | 'audio'
    duration?: number
    createdAt: string
    bytes: Uint8Array
  }[]
}
