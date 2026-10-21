import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, KeyboardEvent } from 'react'
import { appendSyncChange, cleanupOrphanAttachmentBlobs, getAttachmentBlob, getOrCreateDeviceId, getStorageStats, replaceZingData, clearZingUserDataWithSync, loadAnniversaries, loadDailyMoods, loadDailyEnergy, loadDailyEnvironment, loadMenstrualPeriods, loadJournalEntries, loadTasks, loadTags, loadFocusSessions, loadUserSettings, saveUserSettings, putAttachmentBlob, saveAnniversaries, saveDailyMoods, saveDailyEnergy, saveDailyEnvironment, saveMenstrualPeriods, saveJournalEntries, saveTags, saveTasks, saveFocusSessions, saveSyncTombstone, syncWithGitHub, previewGitHubSync, loadGitHubDeviceCredential, saveGitHubDeviceCredential, clearGitHubDeviceCredential } from './db/calendar'
import type { SyncEntityType } from './db/calendar'
import './App.css'

const APP_VERSION = '2.2.12'

import type {
  Anniversary, AnniversaryDraft, AnniversaryType, Attachment, BackupPreview, EncouragementMessage, EncouragementStyle,
  CalendarDay, DailyEnergy, DailyEnvironment, DailyMood, EnergyLevel, EnvironmentOption, FocusSession,
  JournalDraft, JournalEntry, JournalImpact, MenstrualDayLog, MenstrualPeriod, MoodLevel, PostponeEvent,
  RecurrenceException, RecurrenceUnit, SyncedUserSettings, Tag, TagScope, Task, TaskDraft,
  TaskPriority, TaskStatus,
} from './types'
import {
  PRIORITIES, addDaysKey, applyRecurringDisplayMode, buildMonth, buildMultiDaySegments, combinedFocusSecondsByDate,
  currentTime, dayDiff, deadlineStage, draftRepeat, emptyDraft, expandTasks, formatActualDuration, formatDate, normalizedActualDurationMinutes,
  formatFocusDuration, formatTaskRange, fromDateKey, isMultiDayTask, isTaskOverdue,
  clearTaskFocusData, compactCount, materializeOccurrence, normalizeSingleOccurrenceSeries, normalizeTaskScheduling,
  recurrenceFromDraft, repeatPresetLabels, sameDay, taskCoversDate, taskEndDate,
  taskSort, toDateKey,
} from './domain/task'
import {
  cleanDidaContent, didaIso, forestDate, genericDate, genericHeaderIndex, parseCsvRows, parseDidaRecurrence,
  splitImportedTagNames, stableImportHash, zonedParts,
} from './domain/import'
import {
  DEFAULT_TAG, DEFAULT_TAG_ID, DEFAULT_THERMAL_OPTIONS, DEFAULT_WEATHER_OPTIONS, DIDA_APP_SOURCE_TAG,
  DIDA_APP_SOURCE_TAG_ID, EXTERNAL_SOURCE_TAG, EXTERNAL_SOURCE_TAG_ID, FOREST_SOURCE_TAG, FOREST_SOURCE_TAG_ID,
  GENERIC_SOURCE_TAG, GENERIC_SOURCE_TAG_ID, REQUIRED_SYSTEM_TAGS, TAG_COLORS, ensureRequiredSystemTags,
  isImportSourceTag, isImportSourceTagId, normalizeEnvironmentOptions, normalizeTags,
} from './domain/preferences'
import {
  ANNIVERSARY_TYPES, anniversaryDayLimit, anniversaryDistanceLabel, anniversaryIcon, anniversaryMeta, anniversaryOccurrence, buildAnniversaryPageRows, calendarAnnotation,
  emptyAnniversaryDraft, lunarCalendarLabel, lunarFullLabel,
} from './domain/calendar'
import { attachmentExtension, csvCell, makeZip, parseBackupEntries, readZingZip, safeBackupFilename } from './domain/backup'
import type { ZipEntry } from './domain/backup'
import {
  cleanupJournalTagIdsAfterDelete, cleanupTaskTagIdsAfterDelete, focusSelectableTags, managedTagRows,
  normalizedTagName, singleOrdinaryTagIds, sortTagsByColor, tagDateFromKey, tagNameTaken, tagScopeLabel,
  tagsFor, toggleJournalTagIds, toggleTaskTagIds,
} from './domain/tags'
import {
  ENERGIES, IMPACTS, MOODS, activeJournalEntries as filterActiveJournalEntries, emptyJournalDraft,
  energyMap, journalEntriesForDate, moodMap, toggleDailyEnergy, toggleDailyMood,
} from './domain/journal'
import { calculateMenstrualPrediction, menstrualVisualForDate as getMenstrualVisualForDate, patchPeriodDayLog, periodForDate as findPeriodForDate } from './domain/menstrual'
import { buildStatistics } from './domain/statistics'
import { buildSearchResults, normalizeSearchQuery, parseTagSearch } from './domain/search'
import type { SearchFilter, SearchResult } from './domain/search'
import { activeFocusSession as findActiveFocusSession, activeFocusSessions, boundedInteger, countdownMinutes, FOCUS_EDIT_MAX_MINUTES, finishedFocusSession, focusHistoryForDate, focusTiming, formatFocusClock, permanentlyDeleteFocusSession, purgeTrashedFocusSessions, restoreFocusSession, trashFocusSession } from './domain/focus'
import { createEnvironmentOption, deleteEnvironmentOption as markEnvironmentOptionDeleted, environmentByDate as buildEnvironmentByDate, environmentOptionNameTaken, environmentOptionUsed as isEnvironmentOptionUsed, moveEnvironmentOption as reorderEnvironmentOption, setEnvironmentChoice as patchEnvironmentChoice, setEnvironmentLocation as patchEnvironmentLocation, updateEnvironmentOption as patchEnvironmentOption } from './domain/environment'
import { useAppPreferences } from './hooks/useAppPreferences'
import { planSyncDiff, syncEntityKey } from './domain/sync'
import { advanceWordClock, buildSyncedSettings, hydrateWordClock, normalizedIncomingSettings, settingsEqualIgnoringUpdatedAt } from './domain/settings'
import { buildAttachmentLifecycle, referencedAttachmentKeys } from './domain/attachments'
import { DEFAULT_INBOX_SORT_ORDER, groupInboxTodoTasks, inboxActivityAt, inboxActivityKind, inboxOrdinaryTaskTagId, moveInboxSortKey, normalizeInboxSortOrder, sortCompletedInboxTasks } from './domain/inbox'
import type { InboxSortKey } from './domain/inbox'

function loadEnvironmentOptions(key:string, defaults:EnvironmentOption[]) {
  try {
    const rows=JSON.parse(localStorage.getItem(key)||'[]')
    if(Array.isArray(rows)) return normalizeEnvironmentOptions(rows as EnvironmentOption[],defaults)
  } catch {}
  return normalizeEnvironmentOptions(undefined,defaults)
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function MoodFace({ level }: { level: MoodLevel }) {
  const common = { viewBox: '0 0 64 64', className: `mood-face-svg mood-face-${level}`, 'aria-hidden': true } as const

  if (level === 1) return (
    <svg {...common}>
      <circle className="mood-ring" cx="32" cy="32" r="26" />
      <path className="mood-line" d="M15.5 21.5l10 10M25.5 21.5l-10 10" />
      <path className="mood-line" d="M38.5 21.5l10 10M48.5 21.5l-10 10" />
      <path className="mood-line" d="M19 45c3-4 6 4 9 0s6-4 9 0 6 4 9 0" />
    </svg>
  )
  if (level === 2) return (
    <svg {...common}>
      <circle className="mood-ring" cx="32" cy="32" r="26" />
      <path className="mood-thin" d="M16.5 24.5c3.1-2.2 6.6-2.2 9.7 0M37.8 24.5c3.1-2.2 6.6-2.2 9.7 0" />
      <circle className="mood-fill" cx="21.5" cy="28.5" r="2.1" />
      <circle className="mood-fill" cx="42.5" cy="28.5" r="2.1" />
      <path className="mood-line" d="M21 45c5.7-5.6 16.3-5.6 22 0" />
    </svg>
  )
  if (level === 3) return (
    <svg {...common}>
      <circle className="mood-ring" cx="32" cy="32" r="26" />
      <circle className="mood-fill" cx="22" cy="26" r="2.4" />
      <circle className="mood-fill" cx="42" cy="26" r="2.4" />
      <path className="mood-line" d="M23 43h18" />
    </svg>
  )
  if (level === 4) return (
    <svg {...common}>
      <circle className="mood-ring" cx="32" cy="32" r="26" />
      <circle className="mood-fill" cx="21.5" cy="27" r="2.2" />
      <path className="mood-thin" d="M38 27c2.7-1.6 5.5-1.6 8.2 0" />
      <path className="mood-line" d="M20.5 39.5c5.7 4.4 15.5 5.1 23.5-.8" />
    </svg>
  )



  return (
    <svg {...common}>
      <circle className="mood-ring" cx="32" cy="32" r="26" />
      <path className="mood-line" d="M15.5 28c3-4 8-4 11 0" />
      <path className="mood-line" d="M37.5 28c3-4 8-4 11 0" />
      <path className="mood-line" d="M18.5 37c5.5 10.5 21.5 10.5 27 0" />
    </svg>
  )
}

function EnergyBattery({ level }: { level: EnergyLevel }) {
  return <span className={`energy-battery energy-${level}`} aria-hidden="true">
    <span className="battery-cap" />
    <span className="battery-body">{[5,4,3,2,1].map(cell => <span key={cell} className={`battery-cell${cell <= level ? ' filled' : ''}`} />)}</span>
  </span>
}


async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const targetBytes = 1024 * 1024
  let width = bitmap.width
  let height = bitmap.height
  const initialScale = Math.min(1, 1800 / Math.max(width, height))
  width = Math.max(1, Math.round(width * initialScale))
  height = Math.max(1, Math.round(height * initialScale))

  const render = (w: number, h: number, quality: number) => new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片压缩失败')), 'image/webp', quality)
  })

  let blob: Blob | null = null
  // Mobile photos can remain several MB after one quality pass. Reduce quality first,
  // then dimensions, and validate the final stored blob rather than trusting one pass.
  for (let resizeRound = 0; resizeRound < 6; resizeRound += 1) {
    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
      blob = await render(width, height, quality)
      if (blob.size <= targetBytes) { bitmap.close(); return blob }
    }
    width = Math.max(640, Math.round(width * 0.82))
    height = Math.max(640, Math.round(height * 0.82))
  }
  bitmap.close()
  if (!blob || blob.size > targetBytes) throw new Error('这张图片压缩后仍超过 1 MB，请选择分辨率更低的图片')
  return blob
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function AttachmentThumb({ attachment, onRemove, onPreview }: { attachment: Attachment; onRemove?: () => void; onPreview: (attachment: Attachment) => void }) {
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    getAttachmentBlob(attachment.storageKey).then(blob => {
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.storageKey])

  return <div className="attachment-card">
    <button className="attachment-image-button" type="button" onClick={() => onPreview(attachment)} disabled={!url} aria-label={`预览 ${attachment.filename}`}>
      {url ? <img src={url} alt="" /> : <span className="attachment-loading">加载中…</span>}
    </button>
    <div className="attachment-card-info">
      <span className="attachment-card-name" title={attachment.filename}>{attachment.filename}</span>
      <span className="attachment-card-size">压缩后 {formatFileSize(attachment.size)}</span>
    </div>
    {onRemove && <button className="attachment-remove-button" type="button" onClick={onRemove} aria-label={`删除 ${attachment.filename}`}>×</button>}
  </div>
}

function StorageImage({ attachment, onPreview }: { attachment: Attachment; onPreview:(attachment:Attachment)=>void }) {
  const [url,setUrl]=useState('')
  useEffect(() => {
    let active=true, objectUrl=''
    getAttachmentBlob(attachment.storageKey).then(blob => { if (!active || !blob) return; objectUrl=URL.createObjectURL(blob); setUrl(objectUrl) })
    return () => { active=false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  },[attachment.storageKey])
  return <button type="button" className="storage-image-item" onClick={()=>onPreview(attachment)}>{url ? <img src={url} alt={attachment.filename}/> : <span>加载中…</span>}<small>{attachment.filename}</small></button>
}

function AudioAttachment({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true, objectUrl = ''
    getAttachmentBlob(attachment.storageKey).then(blob => {
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl)
    })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [attachment.storageKey])
  return url ? <audio className="journal-audio-player" controls src={url} /> : <span>录音加载中…</span>
}

function downloadTextFile(filename:string,text:string,mimeType:string) {
  const blob=new Blob(['\ufeff',text],{type:mimeType}), url=URL.createObjectURL(blob), link=document.createElement('a')
  link.href=url; link.download=filename; document.body.appendChild(link); link.click(); link.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}


type ExternalImportStage = 'sources' | 'generic-file' | 'generic-preview' | 'dida-file' | 'dida-preview' | 'forest-file' | 'forest-preview'
type DidaImportPreview = {
  fileName:string
  total:number
  tasks:Task[]
  tags:Tag[]
  duplicateCount:number
  skippedNoDate:number
  strippedAttachmentCount:number
  ignoredChecklistCount:number
}
type ForestImportPreview = {
  fileName:string
  total:number
  sessions:FocusSession[]
  tags:Tag[]
  duplicateCount:number
  failedCount:number
  invalidCount:number
  createdTagCount:number
  reusedTagCount:number
}
async function recordSyncDiff(entityType: SyncEntityType, previousRows: any[], nextRows: any[]) {
  const operations = planSyncDiff(entityType, previousRows, nextRows)
  if (!operations.length) return false
  const deviceId = getOrCreateDeviceId()
  const now = new Date().toISOString()
  for (const operation of operations) {
    if (operation.operation === 'delete') {
      await saveSyncTombstone({ key: syncEntityKey(entityType, operation.entityId), entityType, entityId: operation.entityId, deletedAt: now, deviceId })
    }
    await appendSyncChange({ ...operation, changedAt: now, deviceId })
  }
  return true
}

function App() {
  // v1.1.6: keep the current-day object stable across ordinary UI renders.
  // A fresh Date here invalidated the entire continuous-calendar memo on every
  // button click (search, Today, Day Detail, etc.), rebuilding all month cells.
  const [today] = useState(() => new Date())
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [isMobileCalendar, setIsMobileCalendar] = useState(() => window.matchMedia('(max-width: 620px)').matches)
  const [mobileActiveMonth, setMobileActiveMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [mobileMonths, setMobileMonths] = useState(() => Array.from({length:7}, (_,index) => new Date(today.getFullYear(), today.getMonth() + index - 3, 1)))
  const continuousCalendarRef = useRef<HTMLDivElement | null>(null)
  const pendingCalendarScrollRef = useRef<string | null>(isMobileCalendar ? `date:${toDateKey(today)}` : null)
  const [mobileCalendarPositionReady, setMobileCalendarPositionReady] = useState(() => !isMobileCalendar)
  const pendingPrependAnchorRef = useRef<{key:string; top:number} | null>(null)
  const dayDetailOriginScrollRef = useRef<number | null>(null)
  const dayDetailCloseTimerRef = useRef<number | null>(null)
  const openDayRef = useRef<(date: Date) => void>(() => {})
  const [dayDetailClosing, setDayDetailClosing] = useState(false)
  const [moodMonth, setMoodMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [monthPickerTarget, setMonthPickerTarget] = useState<'calendar'|'mood'|null>(null)
  const [overdueInboxOpen, setOverdueInboxOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [inboxSortOrder, setInboxSortOrder] = useState<InboxSortKey[]>(() => {
    try { return normalizeInboxSortOrder(JSON.parse(localStorage.getItem('zing:inboxSortOrder') || 'null')) } catch { return [...DEFAULT_INBOX_SORT_ORDER] }
  })
  const inboxSortDragRef = useRef<InboxSortKey | null>(null)
  const [inboxSortDropTarget, setInboxSortDropTarget] = useState<InboxSortKey | null>(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const [trashFilter, setTrashFilter] = useState<'all'|'task'|'journal'|'anniversary'|'focus'>('all')
  const [monthPickerYear, setMonthPickerYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayDetailOpen, setDayDetailOpen] = useState(false)
  const [mainView, setMainView] = useState<'calendar' | 'statistics' | 'anniversaries' | 'settings'>('calendar')
  const [statsRange, setStatsRange] = useState<'week'|'month'|'30d'|'year'|'all'>('30d')
  const [weatherOptions, setWeatherOptions] = useState<EnvironmentOption[]>(() => loadEnvironmentOptions('zing:weatherOptions', DEFAULT_WEATHER_OPTIONS))
  const [thermalOptions, setThermalOptions] = useState<EnvironmentOption[]>(() => loadEnvironmentOptions('zing:thermalOptions', DEFAULT_THERMAL_OPTIONS))
  const [environmentManagerKind, setEnvironmentManagerKind] = useState<'weather'|'thermal'|null>(null)
  const [moodHeatmapYear, setMoodHeatmapYear] = useState<number>(() => today.getFullYear())
  const [wordCloudIgnored, setWordCloudIgnored] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('zing:wordCloudIgnored') || '[]') } catch { return [] }
  })
  const [encouragementMessages, setEncouragementMessages] = useState<EncouragementMessage[]>(() => {
    try { const rows=JSON.parse(localStorage.getItem('zing:encouragementMessages') || '[]'); return Array.isArray(rows)?rows:[] } catch { return [] }
  })
  const [encouragementStyle, setEncouragementStyle] = useState<EncouragementStyle>(() => { const value=localStorage.getItem('zing:encouragementStyle'); return value==='dark'||value==='light'?value:'random' })
  const [encouragementManagerOpen, setEncouragementManagerOpen] = useState(false)
  const [encouragementDraft, setEncouragementDraft] = useState('')
  const [encouragementEditingId, setEncouragementEditingId] = useState<string|null>(null)
  const [encouragementReward, setEncouragementReward] = useState('')
  const [encouragementRewardStyle, setEncouragementRewardStyle] = useState<'dark'|'light'>('dark')
  const lastEncouragementIdRef = useRef<string|null>(null)
  const [wordIgnoreDraft, setWordIgnoreDraft] = useState('')
  const [wordIgnoreManagerOpen, setWordIgnoreManagerOpen] = useState(false)
  const [storageStats, setStorageStats] = useState({ total:0, images:0, audio:0, data:0, attachmentCount:0 })
  const [storageBrowser, setStorageBrowser] = useState<'image'|'audio'|null>(null)
  const [orphanCleanupBusy, setOrphanCleanupBusy] = useState(false)
  const [orphanCleanupOpen, setOrphanCleanupOpen] = useState(false)
  const [orphanAttachments, setOrphanAttachments] = useState<{key:string;url:string;contentType:string;size:number}[]>([])
  const [imageLibraryTarget, setImageLibraryTarget] = useState<'task'|'journal'|null>(null)
  const [backupExporting, setBackupExporting] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')
  const [githubSyncOpen, setGithubSyncOpen] = useState(false)
  const [githubSyncOwner, setGithubSyncOwner] = useState(() => localStorage.getItem('zing:githubSyncOwner') || 'zzZing0-0')
  const [githubSyncRepo, setGithubSyncRepo] = useState(() => localStorage.getItem('zing:githubSyncRepo') || 'zing-calendar-data')
  const [githubSyncBranch, setGithubSyncBranch] = useState(() => localStorage.getItem('zing:githubSyncBranch') || 'main')
  const [githubSyncToken, setGithubSyncToken] = useState('')
  const [githubTokenSaved, setGithubTokenSaved] = useState(false)
  const [githubSyncPreview, setGithubSyncPreview] = useState<{initializedRemote:boolean; rows:{entityType:string;localCount:number;remoteCount:number;mergedCount:number;added:number;updated:number;deleted:number}[]}|null>(null)
  const [githubSyncBusy, setGithubSyncBusy] = useState(false)
  const [githubSyncMessage, setGithubSyncMessage] = useState('')
  const [githubSyncMessageKind, setGithubSyncMessageKind] = useState<'idle'|'working'|'success'|'error'>('idle')
  const [autoSyncToast, setAutoSyncToast] = useState('')
  const [programRefreshBusy, setProgramRefreshBusy] = useState(false)
  const [lastGithubSyncAt, setLastGithubSyncAt] = useState(() => localStorage.getItem('zing:lastGithubSyncAt') || '')
  const [localWriteRevision, setLocalWriteRevision] = useState(0)
  const [backupPreview, setBackupPreview] = useState<BackupPreview|null>(null)
  const [backupRestoring, setBackupRestoring] = useState(false)
  const [resetDataConfirm, setResetDataConfirm] = useState(false)
  const [resettingData, setResettingData] = useState(false)
  const backupInputRef = useRef<HTMLInputElement|null>(null)
  const [externalImportOpen, setExternalImportOpen] = useState(false)
  const [plainExportOpen, setPlainExportOpen] = useState(false)
  const [externalImportStage, setExternalImportStage] = useState<ExternalImportStage>('sources')
  const [didaImportPreview, setDidaImportPreview] = useState<DidaImportPreview|null>(null)
  const [forestImportPreview, setForestImportPreview] = useState<ForestImportPreview|null>(null)
  const [externalImportBusy, setExternalImportBusy] = useState(false)
  const [externalImportMessage, setExternalImportMessage] = useState('')
  const externalImportInputRef = useRef<HTMLInputElement|null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSearchVisible, setMobileSearchVisible] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement | null>(null)
  const selectedIsFuture = Boolean(selectedDate && toDateKey(selectedDate) > toDateKey(today))

  const {
    greeting, setGreeting, weekStartsMonday, setWeekStartsMonday, dateFormat, setDateFormat,
    showEndedTasks, setShowEndedTasks, showAllRecurringTasks, setShowAllRecurringTasks,
    excludeDefaultFocusStats, setExcludeDefaultFocusStats, maxFocusHours, setMaxFocusHours,
    defaultPriority, setDefaultPriority,
  } = useAppPreferences()

  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksHydrated, setTasksHydrated] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<string | null>(null)
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft(today, defaultPriority))
  const taskNotesRef = useRef<HTMLTextAreaElement | null>(null)
  const insertTaskNoteChecklist = () => {
    const textarea = taskNotesRef.current
    const value = draft.notes
    const start = textarea?.selectionStart ?? value.length
    const end = textarea?.selectionEnd ?? start
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const prefix = value.slice(lineStart, start)
    const insertion = prefix.trim().length === 0 ? '☐ ' : `\n☐ `
    const next = value.slice(0, start) + insertion + value.slice(end)
    const cursor = start + insertion.length
    setDraft(current => ({ ...current, notes: next }))
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(cursor, cursor)
    })
  }

  const handleTaskNotesKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return
    const textarea = event.currentTarget
    const value = draft.notes
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start !== end) return
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const line = value.slice(lineStart, start)
    const match = line.match(/^(☐|☑)\s?(.*)$/)
    if (!match) return
    event.preventDefault()
    if (!match[2].trim()) {
      const next = value.slice(0, lineStart) + value.slice(start)
      const cursor = lineStart
      setDraft(current => ({ ...current, notes: next }))
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(cursor, cursor)
      })
      return
    }
    const insertion = `\n${match[1]} `
    const next = value.slice(0, start) + insertion + value.slice(start)
    const cursor = start + insertion.length
    setDraft(current => ({ ...current, notes: next }))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const toggleTaskNoteChecklistLine = () => {
    const textarea = taskNotesRef.current
    if (!textarea) return
    const value = draft.notes
    const start = textarea.selectionStart
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const lineEndRaw = value.indexOf('\n', start)
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw
    const line = value.slice(lineStart, lineEnd)
    if (!/^[☐☑]\s?/.test(line)) return
    const nextMark = line.startsWith('☐') ? '☑' : '☐'
    const next = value.slice(0, lineStart) + nextMark + value.slice(lineStart + 1)
    setDraft(current => ({ ...current, notes: next }))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start, start)
    })
  }

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [dailyMoods, setDailyMoods] = useState<DailyMood[]>([])
  const [dailyEnergy, setDailyEnergy] = useState<DailyEnergy[]>([])
  const [dailyEnvironment, setDailyEnvironment] = useState<DailyEnvironment[]>([])
  const [menstrualPeriods, setMenstrualPeriods] = useState<MenstrualPeriod[]>([])
  const [energyHydrated, setEnergyHydrated] = useState(false)
  const [environmentHydrated, setEnvironmentHydrated] = useState(false)
  const [periodsHydrated, setPeriodsHydrated] = useState(false)
  const [statusCalendarMode, setStatusCalendarMode] = useState<'mood'|'energy'>('mood')
  const energyByDate = useMemo(() => energyMap(dailyEnergy), [dailyEnergy])
  const selectedEnergy = selectedDate ? energyByDate.get(toDateKey(selectedDate)) : undefined
  const environmentByDate = useMemo(() => buildEnvironmentByDate(dailyEnvironment), [dailyEnvironment])
  const selectedEnvironment = selectedDate ? environmentByDate.get(toDateKey(selectedDate)) : undefined
  const menstrualPrediction = useMemo(() => calculateMenstrualPrediction(menstrualPeriods), [menstrualPeriods])
  const menstrualVisualForDate = (key:string) => getMenstrualVisualForDate(key, menstrualPeriods, menstrualPrediction)

  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([])
  const [anniversariesHydrated, setAnniversariesHydrated] = useState(false)
  const [anniversaryEditorOpen, setAnniversaryEditorOpen] = useState(false)
  const [editingAnniversaryId, setEditingAnniversaryId] = useState<string | null>(null)
  const [anniversaryDraft, setAnniversaryDraft] = useState<AnniversaryDraft>(() => emptyAnniversaryDraft(today))
  const [journalHydrated, setJournalHydrated] = useState(false)
  const [moodsHydrated, setMoodsHydrated] = useState(false)
  const [journalEditorOpen, setJournalEditorOpen] = useState(false)
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null)
  const [viewingJournalId, setViewingJournalId] = useState<string | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [timerNow, setTimerNow] = useState(() => Date.now())
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([])
  const [focusHydrated, setFocusHydrated] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [focusMode, setFocusMode] = useState<'stopwatch'|'countdown'>('stopwatch')
  const [focusMinutes, setFocusMinutes] = useState('15')
  const [focusTagIds, setFocusTagIds] = useState<string[]>([DEFAULT_TAG_ID])
  const [focusTagSelectOpen, setFocusTagSelectOpen] = useState(false)
  const [expandedFocusColor, setExpandedFocusColor] = useState<string | null>(null)
  const [focusHistoryDate, setFocusHistoryDate] = useState<string | null>(null)
  const [focusEditId, setFocusEditId] = useState<string | null>(null)
  const [focusEditMinutes, setFocusEditMinutes] = useState('')
  const [focusEditTagIds, setFocusEditTagIds] = useState<string[]>([])
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [journalDraft, setJournalDraft] = useState<JournalDraft>(() => emptyJournalDraft(today))
  const [tags, setTags] = useState<Tag[]>([DEFAULT_TAG])
  const [tagsHydrated, setTagsHydrated] = useState(false)
  const syncSnapshotsRef = useRef<Record<SyncEntityType, any[]>>({ task: [], journal: [], mood: [], energy: [], environment: [], period: [], tag: [], anniversary: [], focus: [], settings: [] })
  const syncSnapshotReadyRef = useRef<Record<SyncEntityType, boolean>>({ task: false, journal: false, mood: false, energy: false, environment: false, period: false, tag: false, anniversary: false, focus: false, settings: false })
  const settingsSyncReadyRef = useRef(false)
  const suppressNextSettingsSyncRef = useRef(false)
  const settingsWordClockRef = useRef<{added:Record<string,string>;removed:Record<string,string>}>({added:{},removed:{}})
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [archivedTagsOpen, setArchivedTagsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [newTagScope, setNewTagScope] = useState<TagScope>('both')
  const [selectedTagManageId, setSelectedTagManageId] = useState<string | null>(null)
  const [tagEditDraft, setTagEditDraft] = useState<{name:string;color:string;scope:TagScope} | null>(null)

  useEffect(() => {
    if (!selectedTagManageId) { setTagEditDraft(null); return }
    const tag = tags.find(item => item.id === selectedTagManageId)
    if (tag) setTagEditDraft({ name: tag.name, color: tag.color, scope: tag.scope })
  }, [selectedTagManageId])
  const [seriesAction, setSeriesAction] = useState<'save' | 'delete' | null>(null)
  const [confirmSingleTask, setConfirmSingleTask] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setRecordingSeconds(value => {
      if (value >= 1799) { window.setTimeout(stopJournalRecording, 0); return 1800 }
      return value + 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [recording, mediaRecorder])

  const openImagePreview = async (attachment: Attachment) => {
    const blob = await getAttachmentBlob(attachment.storageKey)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    setImagePreview(current => {
      if (current?.url) URL.revokeObjectURL(current.url)
      return { url, name: attachment.filename }
    })
  }

  const closeImagePreview = () => {
    setImagePreview(current => {
      if (current?.url) URL.revokeObjectURL(current.url)
      return null
    })
  }

  const openMonthPicker = (target:'calendar'|'mood') => {
    const source=target==='calendar'?(isMobileCalendar?mobileActiveMonth:visibleMonth):moodMonth
    setMonthPickerYear(source.getFullYear())
    setMonthPickerTarget(target)
  }
  const chooseMonth = (monthIndex:number) => {
    const next=new Date(monthPickerYear,monthIndex,1)
    if(monthPickerTarget==='calendar') {
      pendingCalendarScrollRef.current=`${next.getFullYear()}-${next.getMonth()}`
      setVisibleMonth(next); setMobileActiveMonth(next)
    } else if(monthPickerTarget==='mood') setMoodMonth(next)
    setMonthPickerTarget(null)
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 620px)')
    const update = () => setIsMobileCalendar(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const continuousMonths = useMemo(() => isMobileCalendar ? mobileMonths : [visibleMonth], [mobileMonths, visibleMonth, isMobileCalendar])

  useEffect(() => {
    if (!isMobileCalendar) return
    const found = mobileMonths.some(month => month.getFullYear()===visibleMonth.getFullYear() && month.getMonth()===visibleMonth.getMonth())
    if (found) return
    setMobileMonths(Array.from({length:7}, (_,index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + index - 3, 1)))
  }, [visibleMonth, isMobileCalendar, mobileMonths])

  useLayoutEffect(() => {
    const pending = pendingPrependAnchorRef.current
    if (!pending) return
    const anchor = continuousCalendarRef.current?.querySelector<HTMLElement>(`[data-week-key="${pending.key}"]`)
    if (!anchor) return
    const delta = anchor.getBoundingClientRect().top - pending.top
    if (Math.abs(delta) > 0.5) window.scrollBy({top:delta,behavior:'auto'})
    pendingPrependAnchorRef.current = null
  }, [mobileMonths])

  useLayoutEffect(() => {
    if (!isMobileCalendar || mainView !== 'calendar') return

    // The first mobile-calendar layout can run before the day cells / sticky
    // chrome are measurable. Keep the pending target alive and retry on the
    // next animation frames; only consume it after a real scroll succeeds.
    // This also makes initial entry use the exact same positioning path as the
    // Today button without introducing scroll-driven React state.
    let frame = 0
    let attempts = 0
    const maxAttempts = 24

    const positionPendingTarget = () => {
      const pending = pendingCalendarScrollRef.current
      if (!pending) return

      if (pending.startsWith('date:')) {
        const dateKey = pending.slice(5)
        const target = continuousCalendarRef.current?.querySelector<HTMLElement>(`.day-cell[data-date-key="${dateKey}"]`)
        const sticky = document.querySelector<HTMLElement>('.calendar-sticky-header')
        const bottomNav = document.querySelector<HTMLElement>('.bottom-nav')
        const dayDrawer = document.querySelector<HTMLElement>('.day-drawer')
        if (target && sticky) {
          const rect = target.getBoundingClientRect()
          const stickyBottom = sticky.getBoundingClientRect().bottom
          const lowerBoundary = dayDrawer?.getBoundingClientRect().top ?? bottomNav?.getBoundingClientRect().top ?? window.innerHeight
          const usableCenter = stickyBottom + Math.max(0, lowerBoundary - stickyBottom) / 2
          const delta = rect.top + rect.height / 2 - usableCenter
          if (Math.abs(delta) > 1) window.scrollBy({top:delta, behavior:'auto'})
          pendingCalendarScrollRef.current = null
          setMobileCalendarPositionReady(true)
          return
        }
      } else {
        const target = continuousCalendarRef.current?.querySelector<HTMLElement>(`[data-month-key="${pending}"]`)
        if (target) {
          target.scrollIntoView({block:'start', behavior:'auto'})
          pendingCalendarScrollRef.current = null
          setMobileCalendarPositionReady(true)
          return
        }
      }

      attempts += 1
      if (attempts < maxAttempts) frame = window.requestAnimationFrame(positionPendingTarget)
    }

    // Start after one painted frame so the mobile calendar and sticky controls
    // have completed their initial geometry.
    frame = window.requestAnimationFrame(positionPendingTarget)
    return () => window.cancelAnimationFrame(frame)
  }, [visibleMonth, isMobileCalendar, mainView, continuousMonths])

  useEffect(() => {
    if (!isMobileCalendar || mainView !== 'calendar' || dayDetailOpen || !mobileCalendarPositionReady) return
    const nodes = Array.from(continuousCalendarRef.current?.querySelectorAll<HTMLElement>('.continuous-week-section') ?? [])
    if (!nodes.length) return
    const observer = new IntersectionObserver(entries => {
      const candidates = entries.filter(entry => entry.isIntersecting)
        .sort((a,b) => Math.abs(a.boundingClientRect.top - 170) - Math.abs(b.boundingClientRect.top - 170))
      const node = candidates[0]?.target as HTMLElement | undefined
      if (!node) return
      const year=Number(node.dataset.year), month=Number(node.dataset.month)
      if (!Number.isFinite(year) || !Number.isFinite(month)) return
      setMobileActiveMonth(current =>
        current.getFullYear()===year && current.getMonth()===month ? current : new Date(year,month,1)
      )

      const index = nodes.indexOf(node)
      if (index >= nodes.length - 2) {
        setMobileMonths(current => {
          const last=current[current.length-1]
          const additions=Array.from({length:4},(_,offset)=>new Date(last.getFullYear(),last.getMonth()+offset+1,1))
          return [...current,...additions]
        })
      } else if (index <= 1) {
        const firstNode=nodes[0]
        if (firstNode && !pendingPrependAnchorRef.current) {
          pendingPrependAnchorRef.current={key:firstNode.dataset.weekKey ?? '',top:firstNode.getBoundingClientRect().top}
          setMobileMonths(current => {
            const first=current[0]
            const additions=Array.from({length:4},(_,offset)=>new Date(first.getFullYear(),first.getMonth()-(4-offset),1))
            return [...additions,...current]
          })
        }
      }
    }, {root:null, rootMargin:'-150px 0px -55% 0px', threshold:[0,.01,.2]})
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [continuousMonths, isMobileCalendar, mainView, dayDetailOpen, mobileCalendarPositionReady])

  // Keep the mini mood calendar anchored to the day currently opened in Day Detail.
  // It can still be browsed independently afterwards with its own month arrows.
  useEffect(() => {
    if (!selectedDate) return
    setMoodMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  }, [selectedDate])

  useEffect(() => () => {
    if (dayDetailCloseTimerRef.current !== null) window.clearTimeout(dayDetailCloseTimerRef.current)
  }, [])

  useEffect(() => {
    let active = true
    loadTasks<Task>().then(storedTasks => {
      if (!active) return
      setTasks(storedTasks.map(task => normalizeTaskScheduling({ ...task, date: task.date || null, endDate: task.endDate || undefined })))
      setTasksHydrated(true)
    }).catch(error => {
      console.error('Failed to load tasks from IndexedDB', error)
      if (active) setTasksHydrated(true)
    })
    return () => { active = false }
  }, [])

  const setMood = (level: MoodLevel) => {
    if (!selectedDate) return
    const date = toDateKey(selectedDate)
    const updatedAt = new Date().toISOString()
    setDailyMoods(current => toggleDailyMood(current, date, level, updatedAt))
  }

  const setEnergy = (level: EnergyLevel) => {
    if (!selectedDate) return
    const date = toDateKey(selectedDate)
    const updatedAt = new Date().toISOString()
    setDailyEnergy(current => toggleDailyEnergy(current, date, level, updatedAt))
  }

  const setEnvironmentChoice = (kind:'weather'|'thermal', optionId:string) => {
    if (!selectedDate) return
    const date=toDateKey(selectedDate), now=new Date().toISOString()
    setDailyEnvironment(current=>patchEnvironmentChoice(current,date,kind,optionId,now))
  }

  const saveEnvironmentLocation = (city:string, country?:string) => {
    if(!selectedDate) return
    const date=toDateKey(selectedDate), now=new Date().toISOString()
    setDailyEnvironment(current=>patchEnvironmentLocation(current,date,city,country,now))
  }

  const editPastEnvironmentLocation = () => {
    const city=window.prompt('补录当天所在城市',selectedEnvironment?.locationCity||'')
    if(city===null) return
    const trimmed=city.trim()
    if(!trimmed){saveEnvironmentLocation('');return}
    const country=window.prompt('国家 / 地区（可留空）',selectedEnvironment?.locationCountry||'')
    if(country===null) return
    saveEnvironmentLocation(trimmed,country)
  }

  const locateTodayEnvironment = () => {
    if(!selectedDate || toDateKey(selectedDate)!==toDateKey(new Date())) return
    if(!navigator.geolocation){window.alert('当前浏览器不支持定位');return}
    navigator.geolocation.getCurrentPosition(async position=>{
      try{
        const {latitude,longitude}=position.coords
        const response=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=10&addressdetails=1`,{headers:{'Accept':'application/json'}})
        if(!response.ok) throw new Error(`HTTP ${response.status}`)
        const data=await response.json() as {address?:Record<string,string>}
        const address=data.address||{}
        const country=address.country
        const municipalityNames=['北京','上海','天津','重庆']
        const normalizePlace=(value?:string)=>value?.replace(/(特别行政区|市)$/,'').trim()
        const candidates=[address.city,address.municipality,address.state,address.region,address.province].map(normalizePlace).filter((value):value is string=>Boolean(value))
        const municipality=candidates.find(value=>municipalityNames.includes(value))
        const district=normalizePlace(address.city_district||address.district||address.county)
        const primary=municipality||candidates[0]||normalizePlace(address.town)||normalizePlace(address.village)||district
        if(!primary) throw new Error('未识别到城市')
        const locationName=municipality&&district&&district!==municipality ? `${municipality} · ${district}` : primary
        saveEnvironmentLocation(locationName,country)
      }catch(error){
        console.error('Failed to resolve location',error)
        window.alert('已获取位置，但没有识别到城市。')
      }
    },error=>{
      console.error('Failed to get location',error)
      window.alert(error.code===1?'没有获得定位权限。':'暂时无法获取当前位置。')
    },{enableHighAccuracy:false,timeout:10000,maximumAge:300000})
  }

  const handleEnvironmentLocation = () => {
    if(!selectedDate) return
    const date=toDateKey(selectedDate)
    if(date===toDateKey(new Date())){
      if(selectedEnvironment?.locationCity){
        const action=window.confirm(`当前记录：${selectedEnvironment.locationCity}${selectedEnvironment.locationCountry?` · ${selectedEnvironment.locationCountry}`:''}\n\n确定要用当前位置重新定位吗？`)
        if(!action) return
      }
      locateTodayEnvironment()
      return
    }
    editPastEnvironmentLocation()
  }

  const environmentOptionUsed = (kind:'weather'|'thermal', id:string) => isEnvironmentOptionUsed(dailyEnvironment,kind,id)
  const updateEnvironmentOptions = (kind:'weather'|'thermal', updater:(rows:EnvironmentOption[])=>EnvironmentOption[]) => {
    if(kind==='weather') setWeatherOptions(updater)
    else setThermalOptions(updater)
  }
  const addEnvironmentOption = (kind:'weather'|'thermal') => {
    const label=kind==='weather'?'天气':'体感'
    const name=window.prompt(`添加${label}选项`)?.trim()
    if(!name) return
    const emoji=window.prompt(`给「${name}」设置 Emoji（可留空）`,'')?.trim()||undefined
    const rows=kind==='weather'?weatherOptions:thermalOptions
    if(environmentOptionNameTaken(rows,name)){window.alert('已经有同名选项了');return}
    const now=new Date().toISOString()
    updateEnvironmentOptions(kind,current=>createEnvironmentOption(current,kind,crypto.randomUUID(),name,emoji,now))
  }
  const editEnvironmentEmoji = (kind:'weather'|'thermal', item:EnvironmentOption) => {
    const emoji=window.prompt(`修改「${item.name}」的 Emoji（留空则不显示）`,item.emoji||'')
    if(emoji===null) return
    updateEnvironmentOptions(kind,current=>patchEnvironmentOption(current,item.id,{emoji:emoji.trim()||undefined},new Date().toISOString()))
  }
  const renameEnvironmentOption = (kind:'weather'|'thermal', item:EnvironmentOption) => {
    const name=window.prompt('修改名称',item.name)?.trim()
    if(!name||name===item.name) return
    const rows=kind==='weather'?weatherOptions:thermalOptions
    if(environmentOptionNameTaken(rows,name,item.id)){window.alert('已经有同名选项了');return}
    updateEnvironmentOptions(kind,current=>patchEnvironmentOption(current,item.id,{name},new Date().toISOString()))
  }
  const toggleArchiveEnvironmentOption = (kind:'weather'|'thermal', item:EnvironmentOption) => updateEnvironmentOptions(kind,current=>patchEnvironmentOption(current,item.id,{archived:!item.archived},new Date().toISOString()))
  const deleteEnvironmentOption = (kind:'weather'|'thermal', item:EnvironmentOption) => {
    if(item.builtin||environmentOptionUsed(kind,item.id)) return
    if(!window.confirm(`彻底删除“${item.name}”？`)) return
    const now=new Date().toISOString()
    updateEnvironmentOptions(kind,current=>markEnvironmentOptionDeleted(current,item.id,now))
  }
  const moveEnvironmentOption = (kind:'weather'|'thermal', item:EnvironmentOption, direction:-1|1) => {
    updateEnvironmentOptions(kind,current=>reorderEnvironmentOption(current,item.id,direction,new Date().toISOString()))
  }

  const periodForDate = (key:string) => findPeriodForDate(menstrualPeriods, key, toDateKey(today))
  const startPeriod = () => {
    if (!selectedDate) return
    const key=toDateKey(selectedDate)
    const activePeriod=menstrualPeriods
      .filter(period=>!period.endDate)
      .sort((a,b)=>b.startDate.localeCompare(a.startDate))[0]
    if(activePeriod){
      const goToPrevious=window.confirm(`上一次月经（${activePeriod.startDate} 开始）还没有结束。\n\n请先回到上一次月经记录并标记结束，再开始新的月经。\n\n点击“确定”查看上一次月经。`)
      if(goToPrevious){ cancelDayDetailCloseTimer(); setDayDetailClosing(false); setSelectedDate(fromDateKey(activePeriod.startDate)); setDayDetailOpen(true) }
      return
    }
    const now=new Date().toISOString()
    setMenstrualPeriods(current => [...current, { id:crypto.randomUUID(), startDate:key, dayLogs:[], createdAt:now, updatedAt:now }])
  }
  const updatePeriod = (periodId:string, updater:(period:MenstrualPeriod)=>MenstrualPeriod) => {
    setMenstrualPeriods(current => current.map(period => period.id===periodId ? {...updater(period),updatedAt:new Date().toISOString()} : period))
  }
  const endPeriod = (periodId:string, date:string) => updatePeriod(periodId, period => ({...period,endDate:date}))
  const deletePeriod = (periodId:string) => {
    if (!window.confirm('删除这次月经记录？此操作不会影响其他日期。')) return
    setMenstrualPeriods(current => current.filter(period => period.id !== periodId))
  }
  const updatePeriodDayLog = (periodId:string, date:string, patch:Partial<MenstrualDayLog>) => updatePeriod(periodId, period => patchPeriodDayLog(period, date, patch))

  const openJournalEditor = () => {
  const date = selectedDate ?? today
  setEditingJournalId(null)
  setJournalDraft(emptyJournalDraft(date))
  setJournalEditorOpen(true)
  }

  const editJournal = (entry: JournalEntry) => {
  setEditingJournalId(entry.id)
  setJournalDraft({ date: entry.date, hasTime: Boolean(entry.time), time: entry.time ?? currentTime(), title: entry.title || entry.content.slice(0, 60) || '记录', content: entry.title ? entry.content : '', impact: entry.impact, tagIds: entry.tagIds?.length ? entry.tagIds : [DEFAULT_TAG_ID], attachments: entry.attachments ?? [] })
  setJournalEditorOpen(true)
  }

  const closeJournalEditor = () => {
  setJournalEditorOpen(false)
  setEditingJournalId(null)
  }

  const saveJournal = () => {
  const title = journalDraft.title.trim()
  if (!title) return
  const content = journalDraft.content.trim()
  const now = new Date().toISOString()
  const fields = {
    date: journalDraft.date, time: journalDraft.hasTime ? journalDraft.time || undefined : undefined,
    title, content, impact: journalDraft.impact,
    tagIds: journalDraft.tagIds.length ? journalDraft.tagIds : [DEFAULT_TAG_ID],
    attachments: journalDraft.attachments,
  }
  if (editingJournalId) {
    setJournalEntries(current => current.map(entry => {
      if (entry.id !== editingJournalId) return entry
      const nextKeys = new Set(journalDraft.attachments.map(a => a.storageKey))
      const tombstones = { ...(entry.attachmentLinkTombstones ?? {}) }
      ;(entry.attachments ?? []).forEach(a => { if (!nextKeys.has(a.storageKey)) tombstones[a.storageKey] = now })
      journalDraft.attachments.forEach(a => { delete tombstones[a.storageKey] })
      return { ...entry, ...fields, attachmentLinkTombstones: tombstones, updatedAt: now }
    }))
  } else {
    setJournalEntries(current => [...current, { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now }])
  }
  const entryDate = fromDateKey(journalDraft.date)
  setSelectedDate(entryDate)
  setVisibleMonth(new Date(entryDate.getFullYear(), entryDate.getMonth(), 1))
  closeJournalEditor()
  }

  const addJournalImages = async (files: FileList | null) => {
    if (!files?.length) return
    const room = Math.max(0, 9 - journalDraft.attachments.filter(a => a.type === 'image').length)
    const added: Attachment[] = []
    for (const file of Array.from(files).filter(file => file.type.startsWith('image/')).slice(0, room)) {
      const blob = await compressImage(file)
      const id = crypto.randomUUID(), storageKey = `attachment:${id}`
      await putAttachmentBlob(storageKey, blob)
      added.push({ id, type: 'image', filename: file.name, mimeType: blob.type || 'image/webp', size: blob.size, storageKey, createdAt: new Date().toISOString() })
    }
    if (added.length) setJournalDraft(current => ({ ...current, attachments: [...current.attachments, ...added] }))
  }

  const removeJournalAttachment = async (attachment: Attachment) => {
    // Unlink only. The same binary may be referenced by another task/journal.
    setJournalDraft(current => ({ ...current, attachments: current.attachments.filter(item => item.id !== attachment.id) }))
  }

  const startJournalRecording = async () => {
    if (journalDraft.attachments.some(a => a.type === 'audio') || recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType = preferredTypes.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      const startedAt = Date.now()
      recorder.ondataavailable = event => { if (event.data && event.data.size > 0) chunks.push(event.data) }
      recorder.onerror = () => {
        stream.getTracks().forEach(track => track.stop())
        setRecording(false); setMediaRecorder(null); setRecordingSeconds(0)
        window.alert('录音失败，请重新录制。')
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        const duration = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        setRecording(false); setMediaRecorder(null); setRecordingSeconds(0)
        // Tiny container-only blobs (such as the previous 110 B file) contain no playable audio.
        if (duration < 1 || blob.size < 512) {
          window.alert('录音内容为空或时间太短，没有保存。请重新录制。')
          return
        }
        const id = crypto.randomUUID(), storageKey = `attachment:${id}`
        await putAttachmentBlob(storageKey, blob)
        const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'
        setJournalDraft(current => ({ ...current, attachments: [...current.attachments.filter(a => a.type !== 'audio'), {
          id, type: 'audio', filename: `录音-${new Date().toLocaleString()}.${extension}`, mimeType: blob.type, size: blob.size,
          storageKey, duration, createdAt: new Date().toISOString(),
        }] }))
      }
      // A timeslice makes browsers flush audio chunks while recording instead of relying on one final event at stop.
      recorder.start(1000)
      setRecordingSeconds(0); setMediaRecorder(recorder); setRecording(true)
    } catch (error) {
      console.error('Failed to start recording', error)
      window.alert('无法开始录音，请检查麦克风权限。')
    }
  }

  const stopJournalRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.requestData() } catch {}
      window.setTimeout(() => { if (mediaRecorder.state !== 'inactive') mediaRecorder.stop() }, 80)
    }
  }

  const deleteJournal = (id: string) => {
    const now = new Date().toISOString()
    setJournalEntries(current => current.map(entry => entry.id === id ? { ...entry, trashedAt: now, updatedAt: now } : entry))
    setViewingJournalId(current => current === id ? null : current)
  }


  useEffect(() => {
    if (!tasksHydrated) return
    saveTasks(tasks).catch(error => console.error('Failed to save tasks to IndexedDB', error))
    if (!syncSnapshotReadyRef.current.task) {
      syncSnapshotsRef.current.task = tasks
      syncSnapshotReadyRef.current.task = true
    } else {
      const previous = syncSnapshotsRef.current.task
      syncSnapshotsRef.current.task = tasks
      void recordSyncDiff('task', previous, tasks).then(changed => { if (changed) setLocalWriteRevision(value => value + 1) }).catch(error => console.error('Failed to record task sync changes', error))
    }
  }, [tasks, tasksHydrated])

  useEffect(() => {
    let active = true
    loadJournalEntries<JournalEntry>().then(rows => {
      if (!active) return
      setJournalEntries(rows.map(entry => entry.title ? entry : ({ ...entry, title: entry.content?.slice(0, 60) || '记录', content: '' })))
      setJournalHydrated(true)
    }).catch(error => {
      console.error('Failed to load journal entries from IndexedDB', error)
      if (active) setJournalHydrated(true)
    })
    loadTags<Tag>().then(rows => {
      if (!active) return
      const normalizedRows = normalizeTags(rows)
      const healedRows = ensureRequiredSystemTags(normalizedRows)
      // System provenance tags are schema-level records. Recreate them if an older
      // sync/clear path dropped their definitions, while preserving task tagIds.
      setTags(healedRows)
      setTagsHydrated(true)
    }).catch(error => {
      console.error('Failed to load tags', error)
      if (active) setTagsHydrated(true)
    })
    loadAnniversaries<Anniversary>().then(rows => {
      if (!active) return
      setAnniversaries(rows)
      setAnniversariesHydrated(true)
    }).catch(error => {
      console.error('Failed to load anniversaries', error)
      if (active) setAnniversariesHydrated(true)
    })
    loadDailyMoods<DailyMood>().then(rows => {
      if (!active) return
      setDailyMoods(rows)
      setMoodsHydrated(true)
    }).catch(error => {
      console.error('Failed to load daily moods from IndexedDB', error)
      if (active) setMoodsHydrated(true)
    })
    loadDailyEnergy<DailyEnergy>().then(rows => {
      if (!active) return
      setDailyEnergy(rows); setEnergyHydrated(true)
    }).catch(error => { console.error('Failed to load daily energy',error); if(active)setEnergyHydrated(true) })
    loadDailyEnvironment<DailyEnvironment>().then(rows => {
      if (!active) return
      setDailyEnvironment(rows); setEnvironmentHydrated(true)
    }).catch(error => { console.error('Failed to load daily environment',error); if(active)setEnvironmentHydrated(true) })
    loadMenstrualPeriods<MenstrualPeriod>().then(rows => {
      if (!active) return
      setMenstrualPeriods(rows); setPeriodsHydrated(true)
    }).catch(error => { console.error('Failed to load menstrual periods',error); if(active)setPeriodsHydrated(true) })
    loadFocusSessions<FocusSession>().then(rows => {
      if (!active) return
      setFocusSessions(rows); setFocusHydrated(true)
    }).catch(error => { console.error('Failed to load focus sessions',error); if(active)setFocusHydrated(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!focusHydrated) return
    saveFocusSessions(focusSessions).catch(error => console.error('Failed to save focus sessions', error))
    if (!syncSnapshotReadyRef.current.focus) {
      syncSnapshotsRef.current.focus = focusSessions
      syncSnapshotReadyRef.current.focus = true
    } else {
      const previous = syncSnapshotsRef.current.focus
      syncSnapshotsRef.current.focus = focusSessions
      void recordSyncDiff('focus', previous, focusSessions).then(changed => { if (changed) setLocalWriteRevision(value => value + 1) }).catch(error => console.error('Failed to record focus sync changes', error))
    }
  }, [focusSessions, focusHydrated])

  useEffect(() => {
    if (!anniversariesHydrated) return
    saveAnniversaries(anniversaries).catch(error => console.error('Failed to save anniversaries', error))
    if (!syncSnapshotReadyRef.current.anniversary) {
      syncSnapshotsRef.current.anniversary = anniversaries
      syncSnapshotReadyRef.current.anniversary = true
    } else {
      const previous = syncSnapshotsRef.current.anniversary
      syncSnapshotsRef.current.anniversary = anniversaries
      void recordSyncDiff('anniversary', previous, anniversaries).then(changed => { if (changed) setLocalWriteRevision(value => value + 1) }).catch(error => console.error('Failed to record anniversary sync changes', error))
    }
  }, [anniversaries, anniversariesHydrated])

  useEffect(() => {
    if (!journalHydrated) return
    saveJournalEntries(journalEntries).catch(error => console.error('Failed to save journal entries', error))
    if (!syncSnapshotReadyRef.current.journal) {
      syncSnapshotsRef.current.journal = journalEntries
      syncSnapshotReadyRef.current.journal = true
    } else {
      const previous = syncSnapshotsRef.current.journal
      syncSnapshotsRef.current.journal = journalEntries
      void recordSyncDiff('journal', previous, journalEntries).then(changed => { if (changed) setLocalWriteRevision(value => value + 1) }).catch(error => console.error('Failed to record journal sync changes', error))
    }
  }, [journalEntries, journalHydrated])

  useEffect(() => {
    if (!tagsHydrated) return
    saveTags(tags).catch(error => console.error('Failed to save tags', error))
    if (!syncSnapshotReadyRef.current.tag) {
      syncSnapshotsRef.current.tag = tags
      syncSnapshotReadyRef.current.tag = true
    } else {
      const previous = syncSnapshotsRef.current.tag
      syncSnapshotsRef.current.tag = tags
      void recordSyncDiff('tag', previous, tags).then(changed => { if (changed) setLocalWriteRevision(value => value + 1) }).catch(error => console.error('Failed to record tag sync changes', error))
    }
  }, [tags, tagsHydrated])

  useEffect(() => {
    if (!moodsHydrated) return
    saveDailyMoods(dailyMoods).catch(error => console.error('Failed to save daily moods', error))
    if (!syncSnapshotReadyRef.current.mood) {
      syncSnapshotsRef.current.mood = dailyMoods
      syncSnapshotReadyRef.current.mood = true
    } else {
      const previous = syncSnapshotsRef.current.mood
      syncSnapshotsRef.current.mood = dailyMoods
      void recordSyncDiff('mood', previous, dailyMoods).then(changed => { if (changed) setLocalWriteRevision(value => value + 1) }).catch(error => console.error('Failed to record mood sync changes', error))
    }
  }, [dailyMoods, moodsHydrated])

  useEffect(() => {
    if (!energyHydrated) return
    saveDailyEnergy(dailyEnergy).catch(error => console.error('Failed to save daily energy',error))
    if (!syncSnapshotReadyRef.current.energy) { syncSnapshotsRef.current.energy=dailyEnergy; syncSnapshotReadyRef.current.energy=true }
    else { const previous=syncSnapshotsRef.current.energy; syncSnapshotsRef.current.energy=dailyEnergy; void recordSyncDiff('energy',previous,dailyEnergy).then(changed=>{if(changed)setLocalWriteRevision(value=>value+1)}) }
  }, [dailyEnergy,energyHydrated])

  useEffect(() => {
    if (!environmentHydrated) return
    saveDailyEnvironment(dailyEnvironment).catch(error => console.error('Failed to save daily environment',error))
    if (!syncSnapshotReadyRef.current.environment) { syncSnapshotsRef.current.environment=dailyEnvironment; syncSnapshotReadyRef.current.environment=true }
    else { const previous=syncSnapshotsRef.current.environment; syncSnapshotsRef.current.environment=dailyEnvironment; void recordSyncDiff('environment',previous,dailyEnvironment).then(changed=>{if(changed)setLocalWriteRevision(value=>value+1)}) }
  }, [dailyEnvironment,environmentHydrated])

  useEffect(() => {
    if (!periodsHydrated) return
    saveMenstrualPeriods(menstrualPeriods).catch(error => console.error('Failed to save menstrual periods',error))
    if (!syncSnapshotReadyRef.current.period) { syncSnapshotsRef.current.period=menstrualPeriods; syncSnapshotReadyRef.current.period=true }
    else { const previous=syncSnapshotsRef.current.period; syncSnapshotsRef.current.period=menstrualPeriods; void recordSyncDiff('period',previous,menstrualPeriods).then(changed=>{if(changed)setLocalWriteRevision(value=>value+1)}) }
  }, [menstrualPeriods,periodsHydrated])

  useEffect(() => {
    loadGitHubDeviceCredential().then(saved => {
      if (saved?.token) { setGithubSyncToken(saved.token); setGithubTokenSaved(true) }
    }).catch(error => console.error('Failed to load GitHub device credential', error))
  }, [])

  useEffect(() => { localStorage.setItem('zing:weatherOptions', JSON.stringify(weatherOptions)) }, [weatherOptions])
  useEffect(() => { localStorage.setItem('zing:thermalOptions', JSON.stringify(thermalOptions)) }, [thermalOptions])
  useEffect(() => { localStorage.setItem('zing:wordCloudIgnored', JSON.stringify(wordCloudIgnored)) }, [wordCloudIgnored])
  useEffect(() => { localStorage.setItem('zing:encouragementMessages', JSON.stringify(encouragementMessages)) }, [encouragementMessages])
  useEffect(() => { localStorage.setItem('zing:encouragementStyle', encouragementStyle) }, [encouragementStyle])
  useEffect(() => { localStorage.setItem('zing:inboxSortOrder', JSON.stringify(inboxSortOrder)) }, [inboxSortOrder])
  useEffect(() => {
    const now = new Date().toISOString()
    const clocks = advanceWordClock(wordCloudIgnored, settingsWordClockRef.current, now)
    settingsWordClockRef.current = clocks
    const next = buildSyncedSettings({
      greeting, weekStartsMonday, dateFormat, defaultPriority, showEndedTasks, showAllRecurringTasks,
      excludeDefaultFocusStats, wordCloudIgnored, encouragementMessages, encouragementStyle, maxFocusHours, weatherOptions, thermalOptions,
    }, clocks, now)
    if (!settingsSyncReadyRef.current) {
      settingsSyncReadyRef.current = true
      void loadUserSettings<SyncedUserSettings>().then(async rows => {
        if (rows.length) {
          const existing=rows[0]
          settingsWordClockRef.current=hydrateWordClock(existing, now)
          syncSnapshotsRef.current.settings = rows; syncSnapshotReadyRef.current.settings = true; return
        }
        await saveUserSettings([next])
        syncSnapshotsRef.current.settings = [next]
        syncSnapshotReadyRef.current.settings = true
        setLocalWriteRevision(value => value + 1)
      }).catch(error => console.error('Failed to initialize settings sync', error))
      return
    }
    if (suppressNextSettingsSyncRef.current) { suppressNextSettingsSyncRef.current = false; return }
    if (!syncSnapshotReadyRef.current.settings) return
    const previous = syncSnapshotsRef.current.settings
    if (settingsEqualIgnoringUpdatedAt(previous[0], next)) return
    syncSnapshotsRef.current.settings = [next]
    void saveUserSettings([next]).then(()=>recordSyncDiff('settings',previous,[next])).then(changed=>{if(changed)setLocalWriteRevision(value=>value+1)}).catch(error=>console.error('Failed to save settings sync',error))
  }, [greeting,weekStartsMonday,dateFormat,defaultPriority,showEndedTasks,showAllRecurringTasks,excludeDefaultFocusStats,wordCloudIgnored,encouragementMessages,encouragementStyle,maxFocusHours,weatherOptions,thermalOptions])
  useEffect(() => { localStorage.setItem('zing:githubSyncOwner', githubSyncOwner) }, [githubSyncOwner])
  useEffect(() => { localStorage.setItem('zing:githubSyncRepo', githubSyncRepo) }, [githubSyncRepo])
  useEffect(() => { localStorage.setItem('zing:githubSyncBranch', githubSyncBranch) }, [githubSyncBranch])
  useEffect(() => {
    if (mainView !== 'settings' || !tasksHydrated || !journalHydrated) return
    const referencedKeys = referencedAttachmentKeys(tasks, journalEntries)
    cleanupOrphanAttachmentBlobs(referencedKeys)
      .then(() => getStorageStats())
      .then(setStorageStats)
      .catch(error => console.error('Failed to clean or calculate storage', error))
  }, [mainView, tasks, journalEntries, dailyMoods, tags, anniversaries, tasksHydrated, journalHydrated])

  const displayWeekdays = useMemo(() => weekStartsMonday ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0,6)], [weekStartsMonday])
  const formatUiDate = (date: Date) => dateFormat === 'mdy'
    ? `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    : formatDate(date)
  const formatBytes = (bytes:number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`
    if (bytes < 1024*1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`
    return `${(bytes/1024/1024/1024).toFixed(2)} GB`
  }

  const days = useMemo(
    () => buildMonth(visibleMonth.getFullYear(), visibleMonth.getMonth(), weekStartsMonday),
    [visibleMonth, weekStartsMonday],
  )

  const activeTasks = useMemo(() => tasks.filter(task => !task.trashedAt), [tasks])
  const inboxTasks = useMemo(() => activeTasks.filter(task => task.date === null && (showEndedTasks || task.status === 'todo')), [activeTasks, showEndedTasks])
  const inboxTodoGroups = useMemo(() => groupInboxTodoTasks(inboxTasks.filter(task => task.status === 'todo'), inboxSortOrder, tags), [inboxTasks, inboxSortOrder, tags])
  const inboxCompletedTasks = useMemo(() => sortCompletedInboxTasks(inboxTasks.filter(task => task.status !== 'todo')), [inboxTasks])
  const activeJournalEntries = useMemo(() => filterActiveJournalEntries(journalEntries), [journalEntries])
  const activeAnniversaries = useMemo(() => anniversaries.filter(anniversary => !anniversary.trashedAt), [anniversaries])
  type TrashItem =
    | { key:string; entity:'task'; kind:'series'|'occurrence'|'future'; task:Task; occurrenceDate?:string; trashedAt:string }
    | { key:string; entity:'journal'; journal:JournalEntry; trashedAt:string }
    | { key:string; entity:'anniversary'; anniversary:Anniversary; trashedAt:string }
    | { key:string; entity:'focus'; session:FocusSession; trashedAt:string }
  const trashItems = useMemo<TrashItem[]>(() => {
    const items:TrashItem[]=[]
    tasks.forEach(task => {
      if (task.trashedAt) { items.push({key:`task:series:${task.id}`,entity:'task',kind:'series',task,trashedAt:task.trashedAt}); return }
      if (task.trashFuture) items.push({key:`task:future:${task.id}:${task.trashFuture.from}`,entity:'task',kind:'future',task,occurrenceDate:task.trashFuture.from,trashedAt:task.trashFuture.trashedAt});
      ;(Object.entries(task.recurrenceExceptions ?? {}) as [string, RecurrenceException][]).forEach(([date, exception]) => {
        if (exception.trashedAt) items.push({key:`task:occurrence:${task.id}:${date}`,entity:'task',kind:'occurrence',task,occurrenceDate:date,trashedAt:exception.trashedAt})
      })
    })
    journalEntries.forEach(journal => { if (journal.trashedAt) items.push({key:`journal:${journal.id}`,entity:'journal',journal,trashedAt:journal.trashedAt}) })
    anniversaries.forEach(anniversary => { if (anniversary.trashedAt) items.push({key:`anniversary:${anniversary.id}`,entity:'anniversary',anniversary,trashedAt:anniversary.trashedAt}) })
    focusSessions.forEach(session => { if (session.trashedAt) items.push({key:`focus:${session.id}`,entity:'focus',session,trashedAt:session.trashedAt}) })
    return items.sort((a,b)=>b.trashedAt.localeCompare(a.trashedAt))
  },[tasks,journalEntries,anniversaries,focusSessions])
  const trashTaskStatus = (item: Extract<TrashItem,{entity:'task'}>): TaskStatus => item.kind === 'occurrence' && item.occurrenceDate
    ? (item.task.recurrenceExceptions?.[item.occurrenceDate]?.status ?? item.task.status)
    : item.task.status
  const visibleTrashItems = useMemo(() => {
    const filtered = trashFilter === 'all' ? trashItems : trashItems.filter(item => item.entity === trashFilter)
    return showEndedTasks ? filtered : filtered.filter(item => item.entity !== 'task' || trashTaskStatus(item) === 'todo')
  }, [trashItems, trashFilter, showEndedTasks])
  const trashTaskGroups = useMemo(() => {
    if (trashFilter !== 'task') return null
    const taskItems = visibleTrashItems.filter((item): item is Extract<TrashItem,{entity:'task'}> => item.entity === 'task')
    return { active: taskItems.filter(item => trashTaskStatus(item) === 'todo'), ended: taskItems.filter(item => trashTaskStatus(item) !== 'todo') }
  }, [visibleTrashItems, trashFilter])

  const displayTasks = useMemo(() => {
    const start = toDateKey(days[0].date)
    const end = toDateKey(days[days.length - 1].date)
    const expanded = applyRecurringDisplayMode(expandTasks(activeTasks, start, end), activeTasks, showAllRecurringTasks)
    return showEndedTasks ? expanded : expanded.filter(task => task.status === 'todo')
  }, [activeTasks, days, showEndedTasks, showAllRecurringTasks])

  const overdueTasks = useMemo(() => {
    const todayKey=toDateKey(today)
    const yesterday=addDaysKey(todayKey,-1)
    const scheduled=activeTasks.filter((task): task is Task & { date:string } => Boolean(task.date))
    if(!scheduled.length) return [] as Task[]
    const earliest=scheduled.reduce((min,task)=>task.date<min?task.date:min,scheduled[0].date)
    return applyRecurringDisplayMode(expandTasks(scheduled,earliest,yesterday),scheduled,showAllRecurringTasks)
      .filter(task=>isTaskOverdue(task,todayKey))
      .sort((a,b)=>taskEndDate(a).localeCompare(taskEndDate(b)) || b.priority-a.priority || a.title.localeCompare(b.title,'zh-CN'))
  },[activeTasks,today,showAllRecurringTasks])

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return []
    const key = toDateKey(selectedDate)
    const pool = key >= toDateKey(days[0].date) && key <= toDateKey(days[days.length - 1].date)
      ? displayTasks
      : applyRecurringDisplayMode(expandTasks(activeTasks, key, key), activeTasks, showAllRecurringTasks)
    return pool.filter(task => taskCoversDate(task, key) && (showEndedTasks || task.status === 'todo')).sort(taskSort)
  }, [selectedDate, tasks, displayTasks, days, showEndedTasks, showAllRecurringTasks])

  const selectedFocusSeconds = useMemo(() => {
    if (!selectedDate) return 0
    return combinedFocusSecondsByDate(activeTasks, focusSessions, timerNow).get(toDateKey(selectedDate)) ?? 0
  }, [selectedDate, activeTasks, focusSessions, timerNow])

  const focusHistoryRecords = useMemo(() => {
    if (!focusHistoryDate) return []
    return focusHistoryForDate(activeTasks, focusSessions, focusHistoryDate, timerNow)
  },[focusHistoryDate,activeTasks,focusSessions,timerNow])

  const clearTaskFocusRecord = (task:Task) => {
    const now=new Date().toISOString()
    if(task.seriesId&&task.occurrenceDate){
      setTasks(current=>current.map(series=>series.id!==task.seriesId?series:{...series,recurrenceExceptions:{...(series.recurrenceExceptions??{}),[task.occurrenceDate!]:{...clearTaskFocusData(series.recurrenceExceptions?.[task.occurrenceDate!]??{updatedAt:now}),updatedAt:now}},updatedAt:now}))
    } else {
      setTasks(current=>current.map(item=>item.id===task.id?{...clearTaskFocusData(item),updatedAt:now}:item))
    }
  }

  const beginEditDirectFocus = (session:FocusSession) => {
    setFocusEditId(session.id)
    setFocusEditMinutes(String(Math.max(1,Math.round((session.durationSeconds??Math.max(0,(new Date(session.endedAt??new Date().toISOString()).getTime()-new Date(session.startedAt).getTime())/1000))/60))))
    setFocusEditTagIds(session.tagIds)
  }
  const saveDirectFocusEdit = () => {
    if(!focusEditId) return
    const minutes=boundedInteger(focusEditMinutes,1,FOCUS_EDIT_MAX_MINUTES,1), now=new Date().toISOString()
    setFocusSessions(current=>current.map(session=>{
      if(session.id!==focusEditId) return session
      const endedAt=new Date(new Date(session.startedAt).getTime()+minutes*60000).toISOString()
      return {...session,tagIds:singleOrdinaryTagIds(focusEditTagIds.length?focusEditTagIds:session.tagIds),endedAt,durationSeconds:minutes*60,updatedAt:now}
    }))
    setFocusEditId(null)
  }

  const anniversaryOccurrencesByDate = useMemo(() => {
    const map = new Map<string, { anniversary: Anniversary; occurrence: Date }[]>()
    const years = Array.from(new Set(days.map(day => day.date.getFullYear())))
    activeAnniversaries.forEach(anniversary => years.forEach(year => {
      const occurrence = anniversaryOccurrence(anniversary, year)
      if (!occurrence) return
      const key = toDateKey(occurrence)
      const rows = map.get(key) ?? []
      rows.push({ anniversary, occurrence }); map.set(key, rows)
    }))
    return map
  }, [activeAnniversaries, days])

  const selectedAnniversaries = useMemo(() => {
    if (!selectedDate) return []
    const key=toDateKey(selectedDate)
    const cached=anniversaryOccurrencesByDate.get(key)
    if (cached) return cached
    return activeAnniversaries.map(anniversary => {
      const occurrence=anniversaryOccurrence(anniversary, selectedDate.getFullYear())
      return occurrence && toDateKey(occurrence)===key ? {anniversary, occurrence} : null
    }).filter(Boolean) as { anniversary: Anniversary; occurrence: Date }[]
  }, [selectedDate, activeAnniversaries, anniversaryOccurrencesByDate])

  const selectedJournalEntries = useMemo(() => {
    if (!selectedDate) return []
    return journalEntriesForDate(activeJournalEntries, toDateKey(selectedDate))
  }, [selectedDate, activeJournalEntries])

  const viewingJournal = viewingJournalId ? activeJournalEntries.find(entry => entry.id === viewingJournalId) ?? null : null
  const selectedMood = selectedDate ? dailyMoods.find(mood => mood.date === toDateKey(selectedDate)) : undefined
  const selectedImpactTotal = selectedJournalEntries.reduce((sum, entry) => sum + entry.impact, 0)
  const moodsByDate = useMemo(() => moodMap(dailyMoods), [dailyMoods])
  const journalDates = useMemo(() => new Set(activeJournalEntries.map(entry => entry.date)), [journalEntries])
  const moodDays = useMemo(() => buildMonth(moodMonth.getFullYear(), moodMonth.getMonth(), weekStartsMonday), [moodMonth, weekStartsMonday])

  const renderCalendarMonthGrid = (month: Date) => {
    const monthDays = buildMonth(month.getFullYear(), month.getMonth(), weekStartsMonday)
    const rangeStart = toDateKey(monthDays[0].date), rangeEnd = toDateKey(monthDays[monthDays.length-1].date)
    const monthDisplayTasks = (() => {
      const expanded=applyRecurringDisplayMode(expandTasks(activeTasks,rangeStart,rangeEnd),activeTasks,showAllRecurringTasks)
      return showEndedTasks ? expanded : expanded.filter(task=>task.status==='todo')
    })()
    const monthTasksByDate = new Map<string,Task[]>()
    monthDisplayTasks.filter(task=>!isMultiDayTask(task)).forEach(task=>{
      if (!task.date) return; const current=monthTasksByDate.get(task.date)??[]; current.push(task); current.sort(taskSort); monthTasksByDate.set(task.date,current)
    })
    const monthSegments=buildMultiDaySegments(monthDisplayTasks,monthDays)
    const monthOccupied=monthDays.map((_,dayIndex)=>{
      const week=Math.floor(dayIndex/7), column=dayIndex%7
      return new Set(monthSegments.filter(segment=>segment.week===week && column>=segment.startColumn && column<segment.startColumn+segment.span).map(segment=>segment.lane).filter(lane=>lane>=0&&lane<5))
    })
    const monthAnniversaries=new Map<string,{anniversary:Anniversary;occurrence:Date}[]>()
    const years=Array.from(new Set(monthDays.map(day=>day.date.getFullYear())))
    activeAnniversaries.forEach(anniversary=>years.forEach(year=>{
      const occurrence=anniversaryOccurrence(anniversary,year); if(!occurrence)return
      const key=toDateKey(occurrence), rows=monthAnniversaries.get(key)??[]; rows.push({anniversary,occurrence}); monthAnniversaries.set(key,rows)
    }))
    return <div className="calendar-grid">
      {monthDays.map(({date,inCurrentMonth},dayIndex)=>{
        const isToday=sameDay(date,today), isSelected=selectedDate?sameDay(date,selectedDate):false, key=toDateKey(date)
        const dayTasks=monthTasksByDate.get(key)??[], occupiedLanes=monthOccupied[dayIndex]
        const freeSlots=[0,1,2,3,4].filter(slot=>!occupiedLanes.has(slot))
        const visibleCapacity=dayTasks.length<=freeSlots.length?freeSlots.length:Math.max(0,freeSlots.length-1)
        const visibleDayTasks=dayTasks.slice(0,visibleCapacity), visibleTaskSlots=freeSlots.slice(0,visibleDayTasks.length)
        const hiddenDayTaskCount=Math.max(0,dayTasks.length-visibleDayTasks.length), overflowSlot=hiddenDayTaskCount>0?freeSlots[visibleDayTasks.length]:undefined
        const anns=monthAnniversaries.get(key)??[]
        return <button key={key} type="button" className={`day-cell${inCurrentMonth?'':' outside-month'}${isToday?' today':''}${isSelected?' selected':''}`} aria-label={formatDate(date)} data-date-key={key} onClick={()=>openDay(date)}>
          <span className={`day-number${menstrualVisualForDate(key) ? ` menstrual-${menstrualVisualForDate(key)}` : ""}`} data-month-key={date.getDate()===1?`${date.getFullYear()}-${date.getMonth()}`:undefined}>{date.getDate()}</span>
          {(()=>{const annotation=calendarAnnotation(date,weekStartsMonday);return <span className={`lunar-day-label${annotation?` calendar-annotation annotation-${annotation.kind}`:''}`}>{annotation?.label??lunarCalendarLabel(date)}</span>})()}
          {anns.length>0&&<span className="anniversary-cell-icons">{anns.slice(0,anns.length>3?2:3).map(({anniversary})=><span key={anniversary.id} title={anniversary.title}>{anniversaryIcon(anniversary.type)}</span>)}{anns.length>3&&<span className="anniversary-overflow">+{anns.length-2}</span>}</span>}
          {dayTasks.length>0&&<span className="task-preview-list">{visibleDayTasks.map((task,visibleIndex)=><span key={task.id} className={`task-preview priority-${task.priority} status-${task.status}`} style={{'--calendar-slot':visibleTaskSlots[visibleIndex]} as any}>{task.status==='todo'?<span className="priority-dot"/>:<span className="calendar-status-mark" aria-label={task.status==='completed'?'已完成':'已放弃'}>{task.status==='completed'?'✓':'×'}</span>}<span className="task-preview-title">{task.title}</span>{!task.allDay&&task.time&&<span className="task-preview-time">{task.time}</span>}</span>)}{hiddenDayTaskCount>0&&overflowSlot!==undefined&&<span className="more-tasks" style={{'--calendar-slot':overflowSlot} as any}>+{hiddenDayTaskCount}</span>}</span>}
        </button>
      })}
      <div className="multi-day-layer">{monthSegments.map(segment=><button key={`${segment.task.id}-${segment.week}`} type="button" className={`multi-day-bar priority-${segment.task.priority} status-${segment.task.status}`} style={{gridColumn:`${segment.startColumn+1} / span ${segment.span}`,gridRow:segment.week+1,'--lane-offset':`${segment.lane*26}px`} as CSSProperties} onClick={event=>{
        event.stopPropagation(); const rect=event.currentTarget.getBoundingClientRect(); const relativeX=Math.max(0,Math.min(rect.width-.001,event.clientX-rect.left)); const columnOffset=Math.min(segment.span-1,Math.floor(relativeX/(rect.width/segment.span))); const dayIndex=segment.week*7+segment.startColumn+columnOffset; const clickedDay=monthDays[dayIndex]?.date; if(clickedDay)openDayRef.current(clickedDay)
      }} title={`${segment.task.title} · ${segment.task.date} → ${taskEndDate(segment.task)}`}>{segment.task.status==='todo'?<span className="priority-dot"/>:<span className="calendar-status-mark" aria-label={segment.task.status==='completed'?'已完成':'已放弃'}>{segment.task.status==='completed'?'✓':'×'}</span>}<span className="multi-day-title">{segment.task.title}</span></button>)}</div>
    </div>
  }


  // v1.2.0: mobile continuous calendar is a single stream of unique weeks.
  // A cross-month week exists exactly once; month labels are markers, not separate grids.
  const renderCalendarWeek = (weekDays: CalendarDay[], preparedTasks?: Task[], preparedAnniversaries?: Map<string,{anniversary:Anniversary;occurrence:Date}[]>) => {
    const rangeStart=toDateKey(weekDays[0].date), rangeEnd=toDateKey(weekDays[6].date)
    // The continuous mobile calendar prepares recurring tasks once for its whole
    // loaded window. A single-week fallback is retained for non-prepared callers.
    const displayTasks=preparedTasks
      ? preparedTasks.filter(task=>Boolean(task.date)&&task.date!<=rangeEnd&&taskEndDate(task)>=rangeStart)
      : (()=>{const expanded=applyRecurringDisplayMode(expandTasks(activeTasks,rangeStart,rangeEnd),activeTasks,showAllRecurringTasks);return showEndedTasks?expanded:expanded.filter(task=>task.status==='todo')})()
    const tasksByDate=new Map<string,Task[]>()
    displayTasks.filter(task=>Boolean(task.date)&&!isMultiDayTask(task)).forEach(task=>{const key=task.date!;const current=tasksByDate.get(key)??[];current.push(task);current.sort(taskSort);tasksByDate.set(key,current)})
    const segments=buildMultiDaySegments(displayTasks,weekDays)
    const occupied=weekDays.map((_,column)=>new Set(segments.filter(segment=>segment.week===0&&column>=segment.startColumn&&column<segment.startColumn+segment.span).map(segment=>segment.lane).filter(lane=>lane>=0&&lane<5)))
    const anniversaryMap=preparedAnniversaries ?? new Map<string,{anniversary:Anniversary;occurrence:Date}[]>()
    if (!preparedAnniversaries) {
      const years=Array.from(new Set(weekDays.map(day=>day.date.getFullYear())))
      activeAnniversaries.forEach(anniversary=>years.forEach(year=>{const occurrence=anniversaryOccurrence(anniversary,year);if(!occurrence)return;const key=toDateKey(occurrence);if(key<rangeStart||key>rangeEnd)return;const rows=anniversaryMap.get(key)??[];rows.push({anniversary,occurrence});anniversaryMap.set(key,rows)}))
    }
    return <div className="calendar-grid continuous-week-grid">
      {weekDays.map(({date},dayIndex)=>{
        const isToday=sameDay(date,today), isSelected=selectedDate?sameDay(date,selectedDate):false, key=toDateKey(date), dayTasks=tasksByDate.get(key)??[], occupiedLanes=occupied[dayIndex]
        const freeSlots=[0,1,2,3,4].filter(slot=>!occupiedLanes.has(slot)), visibleCapacity=dayTasks.length<=freeSlots.length?freeSlots.length:Math.max(0,freeSlots.length-1)
        const visibleDayTasks=dayTasks.slice(0,visibleCapacity), visibleTaskSlots=freeSlots.slice(0,visibleDayTasks.length), hiddenDayTaskCount=Math.max(0,dayTasks.length-visibleDayTasks.length), overflowSlot=hiddenDayTaskCount>0?freeSlots[visibleDayTasks.length]:undefined
        const anns=anniversaryMap.get(key)??[]
        return <button key={key} type="button" className={`day-cell${isToday?' today':''}${isSelected?' selected':''}`} aria-label={formatDate(date)} data-date-key={key} onClick={()=>openDay(date)}>
          <span className={`day-number${menstrualVisualForDate(key) ? ` menstrual-${menstrualVisualForDate(key)}` : ""}`} data-month-key={date.getDate()===1?`${date.getFullYear()}-${date.getMonth()}`:undefined}>{date.getDate()===1?`${date.getMonth()+1}月`:date.getDate()}</span>
          {(()=>{const annotation=calendarAnnotation(date,weekStartsMonday);return <span className={`lunar-day-label${annotation?` calendar-annotation annotation-${annotation.kind}`:''}`}>{annotation?.label??lunarCalendarLabel(date)}</span>})()}
          {anns.length>0&&<span className="anniversary-cell-icons">{anns.slice(0,anns.length>3?2:3).map(({anniversary})=><span key={anniversary.id} title={anniversary.title}>{anniversaryIcon(anniversary.type)}</span>)}{anns.length>3&&<span className="anniversary-overflow">+{anns.length-2}</span>}</span>}
          {dayTasks.length>0&&<span className="task-preview-list">{visibleDayTasks.map((task,visibleIndex)=><span key={task.id} className={`task-preview priority-${task.priority} status-${task.status}`} style={{'--calendar-slot':visibleTaskSlots[visibleIndex]} as any}>{task.status==='todo'?<span className="priority-dot"/>:<span className="calendar-status-mark" aria-label={task.status==='completed'?'已完成':'已放弃'}>{task.status==='completed'?'✓':'×'}</span>}<span className="task-preview-title">{task.title}</span>{!task.allDay&&task.time&&<span className="task-preview-time">{task.time}</span>}</span>)}{hiddenDayTaskCount>0&&overflowSlot!==undefined&&<span className="more-tasks" style={{'--calendar-slot':overflowSlot} as any}>+{hiddenDayTaskCount}</span>}</span>}
        </button>
      })}
      <div className="multi-day-layer">{segments.filter(segment=>segment.week===0).map(segment=><button key={`${segment.task.id}-${rangeStart}`} type="button" className={`multi-day-bar priority-${segment.task.priority} status-${segment.task.status}`} style={{gridColumn:`${segment.startColumn+1} / span ${segment.span}`,gridRow:1,'--lane-offset':`${segment.lane*19}px`} as CSSProperties} onClick={event=>{event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();const relativeX=Math.max(0,Math.min(rect.width-.001,event.clientX-rect.left));const columnOffset=Math.min(segment.span-1,Math.floor(relativeX/(rect.width/segment.span)));const clickedDay=weekDays[segment.startColumn+columnOffset]?.date;if(clickedDay)openDayRef.current(clickedDay)}} title={`${segment.task.title} · ${segment.task.date} → ${taskEndDate(segment.task)}`}>{segment.task.status==='todo'?<span className="priority-dot"/>:<span className="calendar-status-mark" aria-label={segment.task.status==='completed'?'已完成':'已放弃'}>{segment.task.status==='completed'?'✓':'×'}</span>}<span className="multi-day-title">{segment.task.title}</span></button>)}</div>
    </div>
  }



  const endedTasksViewToggle = (className='') => (
    <label className={`ended-view-toggle ${className}`.trim()} title="显示或隐藏已完成和已放弃任务">
      <span>已结束</span>
      <input type="checkbox" checked={showEndedTasks} onChange={event=>setShowEndedTasks(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )

  const moveMonth = (offset: number) => {
    if (isMobileCalendar) {
      const next = new Date(mobileActiveMonth.getFullYear(), mobileActiveMonth.getMonth() + offset, 1)
      pendingCalendarScrollRef.current=`${next.getFullYear()}-${next.getMonth()}`
      setVisibleMonth(next); setMobileActiveMonth(next)
      return
    }
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const goToday = () => {
    const now = new Date()
    const month = new Date(now.getFullYear(), now.getMonth(), 1)
    if (isMobileCalendar) {
      pendingCalendarScrollRef.current=`date:${toDateKey(now)}`
      setVisibleMonth(month); setMobileActiveMonth(month)
      setSelectedDate(now)
      closeDayDetailImmediately()
      return
    }
    setVisibleMonth(month)
    setSelectedDate(now)
  }

  const cancelDayDetailCloseTimer = () => {
    if (dayDetailCloseTimerRef.current !== null) {
      window.clearTimeout(dayDetailCloseTimerRef.current)
      dayDetailCloseTimerRef.current = null
    }
  }

  const closeDayDetailImmediately = () => {
    cancelDayDetailCloseTimer()
    setDayDetailClosing(false)
    setDayDetailOpen(false)
    dayDetailOriginScrollRef.current=null
  }

  const closeDayDetail = () => {
    if (!dayDetailOpen || dayDetailClosing) return
    cancelDayDetailCloseTimer()
    setDayDetailClosing(true)
    dayDetailCloseTimerRef.current=window.setTimeout(() => {
      dayDetailCloseTimerRef.current=null
      setDayDetailOpen(false)
      setDayDetailClosing(false)
      dayDetailOriginScrollRef.current=null
    }, 260)
  }

  const openDay = (date: Date) => {
    const isMobile = window.matchMedia('(max-width: 760px)').matches

    // A date tap always means select/open. Closing is handled only by the
    // drawer backdrop/close button. This prevents a persistent selected date
    // from ever being interpreted as a "toggle closed" command.
    cancelDayDetailCloseTimer()
    if (dayDetailClosing) setDayDetailClosing(false)

    if (isMobile) {
      if (!dayDetailOpen) dayDetailOriginScrollRef.current=window.scrollY
      setSelectedDate(date)
      setDayDetailOpen(true)

      // Let React paint the sheet first so the tap gets immediate visual feedback.
      // Then move the real week row into position; CSS blocks user panning while the
      // detail is open, without any body-fixed coordinate changes or scroll polling.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const key=toDateKey(date)
          const cell=continuousCalendarRef.current?.querySelector<HTMLElement>(`.day-cell[data-date-key="${key}"]`)
          const sticky=document.querySelector<HTMLElement>('.calendar-sticky-header')
          if (!cell || !sticky) return
          const cellTop=cell.getBoundingClientRect().top
          const stickyBottom=sticky.getBoundingClientRect().bottom
          const target=Math.max(0,window.scrollY + cellTop - stickyBottom)
          if (Math.abs(window.scrollY-target) > 1) window.scrollTo({top:target,behavior:'auto'})
        })
      })
      return
    }

    setSelectedDate(date)
    setDayDetailOpen(true)
  }

  openDayRef.current = openDay


  // v1.2.0: derive one unique week stream from the loaded month window.
  const continuousCalendarContent = useMemo(() => {
    if (!continuousMonths.length) return null
    const firstMonth=continuousMonths[0], lastMonth=continuousMonths[continuousMonths.length-1]
    const firstGrid=buildMonth(firstMonth.getFullYear(),firstMonth.getMonth(),weekStartsMonday)
    const lastGrid=buildMonth(lastMonth.getFullYear(),lastMonth.getMonth(),weekStartsMonday)
    const start=new Date(firstGrid[0].date), end=new Date(lastGrid[lastGrid.length-1].date)
    const rangeStart=toDateKey(start), rangeEnd=toDateKey(end)
    // Expand recurrence once for the entire loaded mobile window instead of once
    // per visible week. This is the main hot path when the continuous calendar
    // grows in either direction.
    const expanded=applyRecurringDisplayMode(expandTasks(activeTasks,rangeStart,rangeEnd),activeTasks,showAllRecurringTasks)
    const preparedTasks=showEndedTasks?expanded:expanded.filter(task=>task.status==='todo')
    const preparedAnniversaries=new Map<string,{anniversary:Anniversary;occurrence:Date}[]>()
    const startYear=start.getFullYear(), endYear=end.getFullYear()
    activeAnniversaries.forEach(anniversary=>{
      for(let year=startYear;year<=endYear;year+=1){
        const occurrence=anniversaryOccurrence(anniversary,year); if(!occurrence) continue
        const key=toDateKey(occurrence); if(key<rangeStart||key>rangeEnd) continue
        const rows=preparedAnniversaries.get(key)??[]; rows.push({anniversary,occurrence}); preparedAnniversaries.set(key,rows)
      }
    })
    const weeks:{days:CalendarDay[];key:string;activeMonth:Date}[]=[]
    for(let cursor=new Date(start);cursor<=end;cursor.setDate(cursor.getDate()+7)){
      const days=Array.from({length:7},(_,index)=>{const date=new Date(cursor);date.setDate(cursor.getDate()+index);return {date,inCurrentMonth:true}})
      const middle=days[3].date
      const activeMonth=new Date(middle.getFullYear(),middle.getMonth(),1)
      weeks.push({days,key:toDateKey(days[0].date),activeMonth})
    }
    return weeks.map(week=>{
      const activeKey=`${week.activeMonth.getFullYear()}-${week.activeMonth.getMonth()}`
      return <section className="continuous-week-section" key={week.key} data-week-key={week.key} data-year={week.activeMonth.getFullYear()} data-month={week.activeMonth.getMonth()}>
        <div data-active-month-key={activeKey}>{renderCalendarWeek(week.days,preparedTasks,preparedAnniversaries)}</div>
      </section>
    })
  }, [continuousMonths,tasks,showEndedTasks,showAllRecurringTasks,activeAnniversaries,menstrualPeriods,menstrualPrediction,weekStartsMonday,today,isMobileCalendar,selectedDate])

  const openAnniversaryEditor = (anniversary?: Anniversary) => {
    if (anniversary) {
      setEditingAnniversaryId(anniversary.id)
      setAnniversaryDraft({ title:anniversary.title, type:anniversary.type, calendar:anniversary.calendar, year:anniversary.year ? String(anniversary.year) : '', month:anniversary.month, day:anniversary.day, isLeapMonth:Boolean(anniversary.isLeapMonth), repeatYearly:anniversary.repeatYearly, notes:anniversary.notes ?? '' })
    } else {
      setEditingAnniversaryId(null)
      setAnniversaryDraft(emptyAnniversaryDraft(selectedDate ?? today))
    }
    setAnniversaryEditorOpen(true)
  }
  const saveAnniversary = () => {
    const title=anniversaryDraft.title.trim(); if (!title) return
    if (anniversaryDraft.type!=='birthday' && !anniversaryDraft.year) return
    const now=new Date().toISOString()
    const fields={ title, type:anniversaryDraft.type, calendar:anniversaryDraft.calendar, year:anniversaryDraft.year ? Number(anniversaryDraft.year) : undefined, month:anniversaryDraft.month, day:anniversaryDraft.day, isLeapMonth:anniversaryDraft.calendar==='lunar' ? anniversaryDraft.isLeapMonth : undefined, repeatYearly:anniversaryDraft.type==='birthday' ? true : anniversaryDraft.repeatYearly, notes:anniversaryDraft.notes.trim() || undefined, updatedAt:now }
    if (editingAnniversaryId) setAnniversaries(cur=>cur.map(a=>a.id===editingAnniversaryId ? {...a,...fields}:a))
    else setAnniversaries(cur=>[...cur,{id:crypto.randomUUID(),...fields,createdAt:now}])
    setAnniversaryEditorOpen(false); setEditingAnniversaryId(null)
  }
  const deleteAnniversary = () => {
    if (!editingAnniversaryId) return
    const now = new Date().toISOString()
    setAnniversaries(cur=>cur.map(a=>a.id===editingAnniversaryId ? {...a,trashedAt:now,updatedAt:now} : a))
    setAnniversaryEditorOpen(false); setEditingAnniversaryId(null)
  }


  const activeFocusSession = useMemo(() => findActiveFocusSession(focusSessions), [focusSessions])
  const maxFocusSeconds = maxFocusHours * 3600
  const activeFocusTiming = focusTiming(activeFocusSession, timerNow, maxFocusSeconds)
  const activeFocusElapsed = activeFocusTiming.elapsedSeconds
  const activeFocusRemaining = activeFocusTiming.remainingSeconds
  const formatClock = formatFocusClock
  const startDirectFocus = () => {
    if (activeTimerTask || activeFocusSession) return
    const plannedMinutes=countdownMinutes(focusMinutes,15)
    const now=new Date().toISOString()
    setFocusSessions(current=>[...current,{id:crypto.randomUUID(),tagIds:focusTagIds.length?focusTagIds:[DEFAULT_TAG_ID],mode:focusMode,...(focusMode==='countdown'?{plannedSeconds:plannedMinutes*60}:{}),startedAt:now,createdAt:now,updatedAt:now}])
    setTimerNow(Date.now())
  }
  const stopDirectFocus = (automatic=false) => {
    if (!activeFocusSession) return
    const lastOrdinaryTagId=activeFocusSession.tagIds.find(id=>id===DEFAULT_TAG_ID||(!isImportSourceTagId(id)&&tags.some(tag=>tag.id===id&&!tag.archived&&(tag.scope==='both'||tag.scope==='task'))))
    // Keep the just-finished focus tag selected when the panel returns to
    // "Start focus", matching the tag restored after closing/reopening it.
    setFocusTagIds([lastOrdinaryTagId??DEFAULT_TAG_ID])
    const nowMs=Date.now()
    const timing=focusTiming(activeFocusSession,nowMs,maxFocusSeconds)
    const dueAtMs=timing.dueAtMs??nowMs
    const endMs=automatic ? dueAtMs : Math.min(nowMs,dueAtMs)
    setFocusSessions(current=>current.map(session=>session.id===activeFocusSession.id?finishedFocusSession(session,endMs):session))
  }


  const activeTimerTask = useMemo(() => {
    for (const task of activeTasks) {
      if (task.activeTimerStartedAt) return task
      if (!task.recurrenceExceptions) continue
      for (const [occurrenceDate, exception] of Object.entries(task.recurrenceExceptions) as [string, RecurrenceException][]) {
        if (!exception.activeTimerStartedAt) continue
        const occurrence = materializeOccurrence(task, occurrenceDate)
        if (occurrence) return occurrence
      }
    }
    return null
  }, [activeTasks])

  useEffect(() => {
    if (!activeTimerTask && !activeFocusSession) return
    setTimerNow(Date.now())
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeTimerTask?.id, activeTimerTask?.activeTimerStartedAt, activeFocusSession?.id])

  useEffect(() => {
    if (!activeFocusSession) return
    const dueAtMs=focusTiming(activeFocusSession,timerNow,maxFocusSeconds).dueAtMs
    if(dueAtMs!==null&&timerNow>=dueAtMs) stopDirectFocus(true)
  },[timerNow,activeFocusSession?.id,activeFocusSession?.plannedSeconds,maxFocusSeconds])

  useEffect(() => {
    if (!tasksHydrated || !activeTimerTask) return
    setMainView('calendar')
    setViewingTask(activeTimerTask)
  }, [tasksHydrated, activeTimerTask?.id])

  useEffect(() => {
    if (!focusHydrated || !activeFocusSession) return
    setMainView('calendar')
    setFocusOpen(true)
  }, [focusHydrated, activeFocusSession?.id])

  useEffect(() => {
    if (!viewingTask) return
    const current = viewingTask.seriesId && viewingTask.occurrenceDate
      ? tasks.find(item => item.id === viewingTask.seriesId)
      : tasks.find(item => item.id === viewingTask.id)
    const refreshed = current
      ? (viewingTask.seriesId && viewingTask.occurrenceDate ? materializeOccurrence(current, viewingTask.occurrenceDate) : current)
      : null
    if (refreshed) setViewingTask(refreshed)
  }, [tasks])

  const updateTimedTask = (task: Task, updater: (current: Task | RecurrenceException) => Partial<Task> | Partial<RecurrenceException>) => {
    const now = new Date().toISOString()
    if (task.seriesId && task.occurrenceDate) {
      setTasks(current => current.map(series => {
        if (series.id !== task.seriesId) return series
        const existing = series.recurrenceExceptions?.[task.occurrenceDate!] ?? { updatedAt: now }
        return {
          ...series,
          recurrenceExceptions: {
            ...series.recurrenceExceptions,
            [task.occurrenceDate!]: { ...existing, ...updater(existing), date: existing.date, updatedAt: now } as RecurrenceException,
          },
          updatedAt: now,
        }
      }))
      return
    }
    setTasks(current => current.map(item => item.id === task.id ? { ...item, ...updater(item), updatedAt: now } : item))
  }

  const startTaskTimer = (task: Task) => {
    if (activeTimerTask || activeFocusSession || task.status !== 'todo') return
    const startedAt = new Date().toISOString()
    updateTimedTask(task, () => ({ activeTimerStartedAt: startedAt }))
    setTimerNow(Date.now())
  }

  const stopTaskTimer = (task: Task, complete = false, forcedEndMs?: number) => {
    if (!task.activeTimerStartedAt) return
    const startedMs = new Date(task.activeTimerStartedAt).getTime()
    const endedAt = new Date(Math.min(forcedEndMs ?? Date.now(), startedMs + maxFocusSeconds * 1000))
    const startedAt = new Date(task.activeTimerStartedAt)
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
    updateTimedTask(task, current => {
      const previousMinutes = Number(current.actualDurationMinutes ?? task.actualDurationMinutes ?? 0)
      const previousRemainder = Number(current.timerSecondsRemainder ?? task.timerSecondsRemainder ?? 0)
      const totalSeconds = previousRemainder + durationSeconds
      const addedMinutes = Math.floor(totalSeconds / 60)
      return {
        activeTimerStartedAt: undefined,
        timerSessions: [...(current.timerSessions ?? task.timerSessions ?? []), { startedAt: task.activeTimerStartedAt!, endedAt: endedAt.toISOString(), durationSeconds }],
        timerSecondsRemainder: totalSeconds % 60,
        actualDurationMinutes: previousMinutes + addedMinutes,
        ...(complete ? { status: 'completed' as TaskStatus, completedAt: endedAt.toISOString() } : {}),
      }
    })
  }

  useEffect(() => {
    if (!activeTimerTask?.activeTimerStartedAt) return
    const startMs=new Date(activeTimerTask.activeTimerStartedAt).getTime()
    const capMs=startMs+maxFocusSeconds*1000
    if(timerNow>=capMs) stopTaskTimer(activeTimerTask,false,capMs)
  },[timerNow,activeTimerTask?.id,activeTimerTask?.activeTimerStartedAt,maxFocusSeconds])

  const formatRunningTimer = (task: Task) => {
    if (!task.activeTimerStartedAt) return '00:00:00'
    const seconds = Math.min(maxFocusSeconds, Math.max(0, Math.floor((timerNow - new Date(task.activeTimerStartedAt).getTime()) / 1000)))
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainder = seconds % 60
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(remainder).padStart(2,'0')}`
  }

  const openTaskEditor = () => {
    const date = selectedDate ?? today
    setEditingTaskId(null)
    setEditingOccurrenceDate(null)
    setDraft(emptyDraft(date, defaultPriority))
    setEditorOpen(true)
  }

  const openInboxTaskEditor = () => {
    setEditingTaskId(null)
    setEditingOccurrenceDate(null)
    setDraft({ ...emptyDraft(today, defaultPriority), date: '', endDate: '', allDay: false, time: '', repeatPreset: 'none' })
    setEditorOpen(true)
  }

  const openTaskDetail = (task: Task) => {
    setViewingTask(task)
  }

  const editTask = (task: Task) => {
    if (task.activeTimerStartedAt) return
    setViewingTask(null)
    const series = task.seriesId ? tasks.find(item => item.id === task.seriesId) : task
    if (!series) return
    setEditingTaskId(series.id)
    setEditingOccurrenceDate(task.seriesId ? task.occurrenceDate ?? task.date : null)
    setDraft({
      title: task.title,
      date: task.date ?? '',
      endDate: task.endDate ?? '',
      priority: task.priority,
      allDay: task.allDay,
      time: task.time ?? '',
      deadline: task.deadline ?? '',
      notes: task.notes ?? '',
      actualDurationHours: task.actualDurationMinutes ? String(Math.floor(task.actualDurationMinutes / 60)) : '',
      actualDurationMinutes: task.actualDurationMinutes ? String(task.actualDurationMinutes % 60) : '',
      tagIds: singleOrdinaryTagIds(task.tagIds),
      attachments: task.attachments ?? [],
      ...draftRepeat(series),
    })
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingTaskId(null)
    setEditingOccurrenceDate(null)
  }

  const saveTask = (scope: 'occurrence' | 'future' | 'series' = 'series') => {
    const title = draft.title.trim()
    if (!title) return
    const now = new Date().toISOString()
    const buildFields = (date: string | null, endDate?: string) => ({
      title, date, endDate: date ? endDate : undefined,
      priority: draft.priority, allDay: date ? draft.allDay : false,
      time: date && !draft.allDay ? draft.time || undefined : undefined,
      deadline: draft.deadline || undefined, notes: draft.notes.trim() || undefined,
      actualDurationMinutes: normalizedActualDurationMinutes(draft.actualDurationHours, draft.actualDurationMinutes),
      tagIds: singleOrdinaryTagIds(draft.tagIds),
      attachments: draft.attachments,
    })

    if (editingTaskId) {
      setTasks(current => {
        const series = current.find(task => task.id === editingTaskId)
        if (!series) return current
        const occurrence = editingOccurrenceDate && series.recurrence ? materializeOccurrence(series, editingOccurrenceDate) : null

        if (occurrence && scope === 'occurrence') {
          const existingException = series.recurrenceExceptions?.[editingOccurrenceDate!] ?? { updatedAt: now }
          const exception: RecurrenceException = {
            ...existingException,
            ...buildFields(draft.date, draft.endDate && draft.endDate > draft.date ? draft.endDate : undefined),
            date: draft.date || undefined,
            updatedAt: now,
          }
          return current.map(task => task.id === series.id
            ? { ...task, recurrenceExceptions: { ...task.recurrenceExceptions, [editingOccurrenceDate!]: exception }, updatedAt: now }
            : task)
        }

        if (occurrence && scope === 'future') {
          const splitDate = editingOccurrenceDate!
          const previousDate = addDaysKey(splitDate, -1)
          const oldExceptions = Object.fromEntries(Object.entries(series.recurrenceExceptions ?? {}).filter(([key]) => key < splitDate))
          const futureExceptions = Object.fromEntries(Object.entries(series.recurrenceExceptions ?? {}).filter(([key]) => key >= splitDate))

          // End the old series immediately before this occurrence. Its past history/exceptions remain intact.
          const oldSeries = normalizeSingleOccurrenceSeries({
            ...series,
            recurrence: series.recurrence ? { ...series.recurrence, end: { type: 'date', date: previousDate } } : undefined,
            recurrenceExceptions: oldExceptions,
            updatedAt: now,
          })

          // "不重复" from this occurrence forward means: keep this occurrence as one ordinary task,
          // and discard the future recurrence branch/exceptions.
          if (draft.repeatPreset === 'none') {
            const ordinary: Task = {
              ...series,
              ...buildFields(draft.date, draft.endDate && draft.endDate > draft.date ? draft.endDate : undefined),
              id: crypto.randomUUID(), status: occurrence.status, completedAt: occurrence.completedAt,
              timerSessions: occurrence.timerSessions, timerSecondsRemainder: occurrence.timerSecondsRemainder,
              activeTimerStartedAt: undefined,
              originalDate: draft.date, recurrence: undefined, recurrenceExceptions: undefined,
              createdAt: now, updatedAt: now,
            }
            return [...current.filter(task => task.id !== series.id), oldSeries, ordinary]
          }

          // Otherwise split into a new independent series beginning at the selected occurrence.
          const newSeries: Task = {
            ...series,
            ...buildFields(draft.date, draft.endDate && draft.endDate > draft.date ? draft.endDate : undefined),
            id: crypto.randomUUID(), status: 'todo', completedAt: undefined,
            originalDate: draft.date, recurrence: recurrenceFromDraft(draft),
            recurrenceExceptions: futureExceptions, createdAt: now, updatedAt: now,
          }
          return [...current.filter(task => task.id !== series.id), oldSeries, newSeries]
        }

        // Whole-series edit. If Repeat becomes "不重复", this is a real conversion:
        // recurrence and every old occurrence exception are removed, so nothing can later "revive".
        const seriesDate = (occurrence && draft.date === occurrence.date ? series.date : draft.date) ?? ''
        const seriesEndDate = occurrence && (draft.endDate || '') === (occurrence.endDate || '')
          ? series.endDate
          : (draft.endDate && draft.endDate > seriesDate ? draft.endDate : undefined)
        const seriesDraft: TaskDraft = { ...draft, date: seriesDate, endDate: seriesEndDate ?? '' }
        const nextRecurrence = recurrenceFromDraft(seriesDraft)
        return current.map(task => {
          if (task.id !== series.id) return task
          const nextKeys = new Set(draft.attachments.map(a => a.storageKey))
          const tombstones = { ...(task.attachmentLinkTombstones ?? {}) }
          ;(task.attachments ?? []).forEach(a => { if (!nextKeys.has(a.storageKey)) tombstones[a.storageKey] = now })
          draft.attachments.forEach(a => { delete tombstones[a.storageKey] })
          return normalizeSingleOccurrenceSeries({
            ...task, ...buildFields(seriesDate || null, seriesEndDate), attachmentLinkTombstones: tombstones,
            recurrence: nextRecurrence,
            recurrenceExceptions: nextRecurrence ? task.recurrenceExceptions : undefined,
            updatedAt: now,
          })
        })
      })
    } else {
      const task: Task = {
        id: crypto.randomUUID(),
        ...buildFields(draft.date || null, draft.date && draft.endDate && draft.endDate > draft.date ? draft.endDate : undefined),
        status: 'todo', originalDate: draft.date || undefined, recurrence: recurrenceFromDraft(draft),
        createdAt: now, updatedAt: now,
      }
      setTasks(current => [...current, normalizeSingleOccurrenceSeries(task)])
    }

    if (draft.date) {
      const taskDate = fromDateKey(draft.date)
      setSelectedDate(taskDate)
      setVisibleMonth(new Date(taskDate.getFullYear(), taskDate.getMonth(), 1))
    }
    closeEditor()
  }

  const convertOccurrenceToSingleTask = () => {
    if (!editingTaskId || !editingOccurrenceDate) return
    const title = draft.title.trim()
    if (!title) return
    const now = new Date().toISOString()
    setTasks(current => {
      const series = current.find(task => task.id === editingTaskId)
      if (!series?.recurrence) return current
      const occurrence = materializeOccurrence(series, editingOccurrenceDate)
      if (!occurrence) return current
      const previousDate = addDaysKey(editingOccurrenceDate, -1)
      const oldExceptions = Object.fromEntries(
        Object.entries(series.recurrenceExceptions ?? {}).filter(([key]) => key < editingOccurrenceDate)
      )
      const oldSeries = normalizeSingleOccurrenceSeries({
        ...series,
        recurrence: { ...series.recurrence, end: { type: 'date', date: previousDate } },
        recurrenceExceptions: oldExceptions,
        updatedAt: now,
      })
      const ordinary: Task = {
        ...occurrence,
        id: crypto.randomUUID(),
        seriesId: undefined,
        occurrenceDate: undefined,
        title,
        date: draft.date,
        endDate: draft.endDate && draft.endDate > draft.date ? draft.endDate : undefined,
        priority: draft.priority,
        allDay: draft.allDay,
        time: draft.allDay ? undefined : draft.time || undefined,
        deadline: draft.deadline || undefined,
        notes: draft.notes.trim() || undefined,
        tagIds: singleOrdinaryTagIds(draft.tagIds),
        attachments: draft.attachments,
        originalDate: draft.date,
        recurrence: undefined,
        recurrenceExceptions: undefined,
        createdAt: now,
        updatedAt: now,
      }
      return [...current.filter(task => task.id !== series.id), oldSeries, ordinary]
    })
    setConfirmSingleTask(false)
    closeEditor()
  }

  const showRandomEncouragement = () => {
    const active=encouragementMessages.filter(item=>!item.deletedAt&&item.text.trim())
    if (!active.length) return
    const candidates=active.length>1?active.filter(item=>item.id!==lastEncouragementIdRef.current):active
    const picked=candidates[Math.floor(Math.random()*candidates.length)] || active[0]
    lastEncouragementIdRef.current=picked.id
    setEncouragementRewardStyle(encouragementStyle==='random'?(Math.random()<0.5?'dark':'light'):encouragementStyle)
    setEncouragementReward(picked.text.trim())
  }

  const setTaskStatus = (task: Task, status: TaskStatus) => {
    const now = new Date().toISOString()
    const completedAt = status === 'completed' ? now : undefined
    if (task.seriesId && task.occurrenceDate) {
      setTasks(current => current.map(series => series.id === task.seriesId ? {
        ...series,
        recurrenceExceptions: { ...series.recurrenceExceptions, [task.occurrenceDate!]: { ...series.recurrenceExceptions?.[task.occurrenceDate!], status, completedAt, updatedAt: now } },
        updatedAt: now,
      } : series))
    } else setTasks(current => current.map(item => item.id === task.id ? { ...item, status, completedAt, updatedAt: now } : item))
    if (status === 'completed' && task.status !== 'completed') showRandomEncouragement()
  }

  const postponeTask = (task: Task, newDate: string) => {
    if (!task.date || !newDate || newDate <= task.date) return
    const now = new Date().toISOString()
    const duration = dayDiff(task.date, taskEndDate(task))
    const event: PostponeEvent = { from: task.date, to: newDate, at: now }
    if (task.seriesId && task.occurrenceDate) {
      setTasks(current => current.map(series => series.id === task.seriesId ? {
        ...series,
        recurrenceExceptions: {
          ...series.recurrenceExceptions,
          [task.occurrenceDate!]: {
            ...series.recurrenceExceptions?.[task.occurrenceDate!],
            date: newDate,
            endDate: duration > 0 ? addDaysKey(newDate, duration) : undefined,
            postponeHistory: [...(task.postponeHistory ?? []), event], updatedAt: now,
          },
        }, updatedAt: now,
      } : series))
    } else setTasks(current => current.map(item => item.id === task.id ? {
      ...item, originalDate: item.originalDate ?? item.date ?? undefined, date: newDate,
      endDate: duration > 0 ? addDaysKey(newDate, duration) : undefined,
      postponeHistory: [...(item.postponeHistory ?? []), event], updatedAt: now,
    } : item))
  }

  const addTaskImages = async (files: FileList | null) => {
    if (!files?.length) return
    const added: Attachment[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const blob = await compressImage(file)
      const id = crypto.randomUUID()
      const storageKey = `attachment:${id}`
      await putAttachmentBlob(storageKey, blob)
      added.push({ id, type: 'image', filename: file.name, mimeType: blob.type || 'image/webp', size: blob.size, storageKey, createdAt: new Date().toISOString() })
    }
    if (added.length) setDraft(current => ({ ...current, attachments: [...current.attachments, ...added] }))
  }

  const removeTaskImage = async (attachment: Attachment) => {
    // Unlink only. Shared library images keep one binary and can be referenced many times.
    setDraft(current => ({ ...current, attachments: current.attachments.filter(item => item.id !== attachment.id) }))
  }

  const deleteTask = (task: Task, scope: 'occurrence' | 'future' | 'series' = 'series') => {
    const seriesId = task.seriesId ?? task.id
    const occurrenceDate = task.occurrenceDate
    const now = new Date().toISOString()
    if (occurrenceDate && scope === 'occurrence') {
      setTasks(current => current.map(series => series.id === seriesId ? {
        ...series,
        recurrenceExceptions: { ...series.recurrenceExceptions, [occurrenceDate]: { ...series.recurrenceExceptions?.[occurrenceDate], deleted: false, trashedAt: now, updatedAt: now } },
        updatedAt: now,
      } : series))
      return
    }
    if (occurrenceDate && scope === 'future') {
      setTasks(current => current.map(series => series.id === seriesId ? { ...series, trashFuture:{from:occurrenceDate,trashedAt:now}, updatedAt:now } : series))
      return
    }
    setTasks(current => current.map(series => series.id === seriesId ? { ...series, trashedAt:now, updatedAt:now } : series))
  }

  const restoreTrashItem = (item: TrashItem) => {
    if(item.entity==='focus') { const now=new Date().toISOString(); setFocusSessions(current=>current.map(session=>session.id===item.session.id?restoreFocusSession(session,now):session)); setAutoSyncToast('✓ 已恢复专注'); return }
    if(item.entity==='journal') { const now=new Date().toISOString(); setJournalEntries(current=>current.map(entry=>entry.id===item.journal.id?{...entry,trashedAt:undefined,updatedAt:now}:entry)); setAutoSyncToast('✓ 已恢复记录'); return }
    if(item.entity==='anniversary') { const now=new Date().toISOString(); setAnniversaries(current=>current.map(a=>a.id===item.anniversary.id?{...a,trashedAt:undefined,updatedAt:now}:a)); setAutoSyncToast('✓ 已恢复纪念日'); return }
    const now=new Date().toISOString()
    setTasks(current=>current.map(task=>{
      if(task.id!==item.task.id) return task
      if(item.kind==='series') return {...task,trashedAt:undefined,updatedAt:now}
      if(item.kind==='future') return {...task,trashFuture:undefined,updatedAt:now}
      const date=item.occurrenceDate!
      return {...task,recurrenceExceptions:{...task.recurrenceExceptions,[date]:{...task.recurrenceExceptions?.[date],trashedAt:undefined,updatedAt:now}},updatedAt:now}
    }))
    setAutoSyncToast('✓ 已恢复任务')
  }

  const permanentlyDeleteTrashItem = (item: TrashItem) => {
    if(item.entity==='focus') { setFocusSessions(current=>permanentlyDeleteFocusSession(current,item.session.id)); return }
    if(item.entity==='journal') { setJournalEntries(current=>current.filter(entry=>entry.id!==item.journal.id)); return }
    if(item.entity==='anniversary') { setAnniversaries(current=>current.filter(a=>a.id!==item.anniversary.id)); return }
    const now=new Date().toISOString()
    if(item.kind==='series') { setTasks(current=>current.filter(task=>task.id!==item.task.id)); return }
    if(item.kind==='occurrence') {
      const date=item.occurrenceDate!
      setTasks(current=>current.map(task=>task.id===item.task.id?{...task,recurrenceExceptions:{...task.recurrenceExceptions,[date]:{...task.recurrenceExceptions?.[date],trashedAt:undefined,deleted:true,updatedAt:now}},updatedAt:now}:task)); return
    }
    const date=item.occurrenceDate!, previousDate=addDaysKey(date,-1)
    setTasks(current=>current.map(task=>task.id===item.task.id?normalizeSingleOccurrenceSeries({...task,trashFuture:undefined,recurrence:task.recurrence?{...task.recurrence,end:{type:'date',date:previousDate}}:undefined,recurrenceExceptions:Object.fromEntries(Object.entries(task.recurrenceExceptions??{}).filter(([key])=>key<date)),updatedAt:now}):task))
  }

  const clearTrash = () => {
    if (!trashItems.length) return
    const now = new Date().toISOString()
    setJournalEntries(current => current.filter(entry => !entry.trashedAt))
    setAnniversaries(current => current.filter(anniversary => !anniversary.trashedAt))
    setFocusSessions(current => purgeTrashedFocusSessions(current))
    setTasks(current => current.flatMap(task => {
      if (task.trashedAt) return []
      let next = task
      const trashedDates = Object.entries(next.recurrenceExceptions ?? {}).filter(([,exception]) => exception.trashedAt).map(([date]) => date)
      if (trashedDates.length) {
        const exceptions = { ...next.recurrenceExceptions }
        trashedDates.forEach(date => { exceptions[date] = { ...exceptions[date], trashedAt: undefined, deleted: true, updatedAt: now } })
        next = { ...next, recurrenceExceptions: exceptions, updatedAt: now }
      }
      if (next.trashFuture) {
        const from = next.trashFuture.from, previousDate = addDaysKey(from,-1)
        next = normalizeSingleOccurrenceSeries({ ...next, trashFuture: undefined, recurrence: next.recurrence ? { ...next.recurrence, end:{type:'date',date:previousDate} } : undefined, recurrenceExceptions:Object.fromEntries(Object.entries(next.recurrenceExceptions??{}).filter(([key])=>key<from)), updatedAt:now })
      }
      return [next]
    }))
  }

  const stopRepeating = (series: Task, occurrenceDate: string) => {
    const now = new Date().toISOString()
    setTasks(current => current.map(item => item.id === series.id ? normalizeSingleOccurrenceSeries({
      ...item,
      recurrence: item.recurrence ? { ...item.recurrence, end: { type: 'date', date: occurrenceDate } } : undefined,
      recurrenceExceptions: Object.fromEntries(Object.entries(item.recurrenceExceptions ?? {}).filter(([key]) => key <= occurrenceDate)),
      updatedAt: now,
    }) : item))
    closeEditor()
  }

  const toggleDraftTag = (kind: 'task' | 'journal', id: string) => {
    if (kind === 'task') setDraft(current => ({ ...current, tagIds: toggleTaskTagIds(current.tagIds, id) }))
    else setJournalDraft(current => ({ ...current, tagIds: toggleJournalTagIds(current.tagIds, id) }))
  }

  const addTag = () => {
    const name = newTagName.trim()
    if (!name) return
    const existing = tags.find(tag => normalizedTagName(tag.name) === normalizedTagName(name))
    if (existing) {
      if (!existing.system && existing.scope !== 'both' && existing.scope !== newTagScope) {
        const upgrade = window.confirm(`#${existing.name} 已存在于「${tagScopeLabel(existing.scope)}」。\n\n是否更改为「共享标签」？`)
        if (upgrade) {
          setTags(current => current.map(tag => tag.id === existing.id ? { ...tag, scope: 'both', updatedAt: new Date().toISOString() } : tag))
          setNewTagName('')
          setNewTagScope('both')
          setSelectedTagManageId(existing.id)
          setAutoSyncToast(`✓ #${existing.name} 已改为共享标签`)
        }
        return
      }
      if (!existing.system && newTagScope === 'both' && existing.scope !== 'both') {
        const upgrade = window.confirm(`#${existing.name} 已存在于「${tagScopeLabel(existing.scope)}」。\n\n是否更改为「共享标签」？`)
        if (upgrade) {
          setTags(current => current.map(tag => tag.id === existing.id ? { ...tag, scope: 'both', updatedAt: new Date().toISOString() } : tag))
          setNewTagName('')
          setSelectedTagManageId(existing.id)
          setAutoSyncToast(`✓ #${existing.name} 已改为共享标签`)
        }
        return
      }
      setAutoSyncToast(`⚠ #${existing.name} 已存在于${existing.system ? '系统标签' : `「${tagScopeLabel(existing.scope)}」`}`)
      return
    }
    const id = crypto.randomUUID()
    setTags(current => [...current, { id, name, color: newTagColor, scope: newTagScope, sortOrder: Math.max(-1, ...current.filter(tag => !tag.system).map(tag => tag.sortOrder ?? 0)) + 1, updatedAt: new Date().toISOString() }])
    setNewTagName('')
  }

  const closeTagEditor = () => {
    setSelectedTagManageId(null)
    setTagEditDraft(null)
  }

  const saveTagEdit = (tag: Tag) => {
    if (!tagEditDraft) return
    const name = tagEditDraft.name.trim()
    if (!name) return
    if (tagNameTaken(tags, name, tag.id)) {
      setAutoSyncToast(`⚠ #${name} 已存在`)
      return
    }
    const now = new Date().toISOString()
    setTags(current => current.map(item => item.id === tag.id ? { ...item, name, color: tagEditDraft.color, scope: tagEditDraft.scope, updatedAt: now } : item))
    setNewTagScope(tagEditDraft.scope)
    setAutoSyncToast(`✓ #${name} 已保存`)
    closeTagEditor()
  }

  const setTagArchived = (id: string, archived: boolean) => {
    const archivedAt = archived ? toDateKey(new Date()) : undefined
    setTags(current => current.map(tag => tag.id === id ? { ...tag, archived, archivedAt, updatedAt: new Date().toISOString() } : tag))
  }

  const deleteTag = (id: string) => {
    const tag = tags.find(item=>item.id===id)
    if (id === DEFAULT_TAG_ID || tag?.system) return
    const taskCount = tasks.filter(task => (task.tagIds ?? []).includes(id) || Object.values(task.recurrenceExceptions ?? {}).some(exception => (exception.tagIds ?? []).includes(id))).length
    const focusCount = focusSessions.filter(session => (session.tagIds ?? []).includes(id)).length
    const journalCount = journalEntries.filter(entry => (entry.tagIds ?? []).includes(id)).length
    const linked = taskCount + focusCount + journalCount
    if (linked && !window.confirm(`删除「${tag?.name ?? '该标签'}」？\n\n关联任务 ${taskCount} 条 · 专注 ${focusCount} 条 · 记录 ${journalCount} 条\n关联内容会保留。`)) return
    if (!linked && !window.confirm(`删除「${tag?.name ?? '该标签'}」？`)) return
    const now = new Date().toISOString()
    setTags(current => current.filter(item => item.id !== id))
    setTasks(current => current.map(task => ({
      ...task,
      tagIds: (task.tagIds ?? []).includes(id) ? cleanupTaskTagIdsAfterDelete(task.tagIds, id) : task.tagIds,
      recurrenceExceptions: task.recurrenceExceptions ? Object.fromEntries(Object.entries(task.recurrenceExceptions).map(([key,exception]) => [key, (exception.tagIds ?? []).includes(id) ? {...exception,tagIds:cleanupTaskTagIdsAfterDelete(exception.tagIds,id),updatedAt:now} : exception])) : task.recurrenceExceptions,
      updatedAt: (task.tagIds ?? []).includes(id) || Object.values(task.recurrenceExceptions ?? {}).some(exception => (exception.tagIds ?? []).includes(id)) ? now : task.updatedAt
    })))
    setFocusSessions(current => current.map(session => (session.tagIds ?? []).includes(id) ? {...session,tagIds:cleanupTaskTagIdsAfterDelete(session.tagIds,id),updatedAt:now} : session))
    setJournalEntries(current => current.map(entry => (entry.tagIds ?? []).includes(id) ? {...entry,tagIds:cleanupJournalTagIdsAfterDelete(entry.tagIds,id),updatedAt:now} : entry))
    setSelectedTagManageId(null)
    setAutoSyncToast(`✓ #${tag?.name ?? '标签'} 已删除`)
  }

  const managedTags = useMemo(() => managedTagRows(tags), [tags])

  const activeManagedTags = useMemo(() => managedTags.filter(tag => !tag.archived), [managedTags])
  const archivedTags = useMemo(() => sortTagsByColor(tags.filter(tag => tag.id !== DEFAULT_TAG_ID && !isImportSourceTag(tag) && tag.archived), tags), [tags])

  const tagUsage = useMemo(() => {
    const usage = new Map<string,{tasks:number;journals:number;days:number}>()
    managedTags.forEach(tag => {
      const taskRows = activeTasks.filter(task => (task.tagIds ?? [DEFAULT_TAG_ID]).includes(tag.id))
      const journalRows = activeJournalEntries.filter(entry => (entry.tagIds ?? [DEFAULT_TAG_ID]).includes(tag.id))
      const days = new Set<string>()
      taskRows.forEach(task => {
        if (!task.date) return
        const start = tagDateFromKey(task.date), end = tagDateFromKey(taskEndDate(task))
        if (!start || !end) { days.add(task.date); return }
        for (let cursor=new Date(start); cursor<=end; cursor.setDate(cursor.getDate()+1)) days.add(toDateKey(cursor))
      })
      journalRows.forEach(entry => days.add(entry.date))
      usage.set(tag.id,{tasks:taskRows.length,journals:journalRows.length,days:days.size})
    })
    return usage
  },[managedTags,activeTasks,activeJournalEntries])

  useEffect(() => {
    if (sessionStorage.getItem('zing-program-refresh-pending') !== '1') return
    sessionStorage.removeItem('zing-program-refresh-pending')
    setAutoSyncToast(`✓ 已更新至 v${APP_VERSION}`)
  }, [])

  const refreshProgram = async () => {
    if (programRefreshBusy) return
    setProgramRefreshBusy(true)
    try {
      if (!navigator.onLine) throw new Error('offline')
      // Do not parse a version from sw.js. The service-worker cache generation and
      // the application version are different concepts; parsing the former caused
      // the UI to keep reporting the old v1.7.10.
      await fetch(`/sw.js?check=${Date.now()}`, { cache: 'no-store' })
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) await registration.update()
      }
      // Report success only after the newly loaded application is actually running.
      sessionStorage.setItem('zing-program-refresh-pending', '1')
      window.location.reload()
    } catch {
      setAutoSyncToast('⚠ 无法刷新程序，继续使用本地版本')
      setProgramRefreshBusy(false)
    }
  }

  const normalizedSearch = normalizeSearchQuery(searchQuery)

  const highlightSearch = (text: string) => {
    if (!normalizedSearch) return text
    const lower = text.toLocaleLowerCase()
    const nodes: React.ReactNode[] = []
    let cursor = 0
    let index = lower.indexOf(normalizedSearch)
    let key = 0
    while (index >= 0) {
      if (index > cursor) nodes.push(text.slice(cursor, index))
      nodes.push(<mark key={key++}>{text.slice(index, index + normalizedSearch.length)}</mark>)
      cursor = index + normalizedSearch.length
      index = lower.indexOf(normalizedSearch, cursor)
    }
    if (cursor < text.length) nodes.push(text.slice(cursor))
    return nodes
  }

  const { tagSearchMode } = parseTagSearch(normalizedSearch)

  const searchResults = useMemo<SearchResult[]>(() => buildSearchResults({
    normalizedSearch,
    searchFilter,
    activeTasks,
    activeJournalEntries,
    activeAnniversaries,
    managedTags,
    tagUsage,
    today,
  }), [normalizedSearch, searchFilter, activeTasks, activeJournalEntries, activeAnniversaries, managedTags, tagUsage])

  const searchDateLabel = (result: SearchResult) => {
    if (result.kind === 'tag') return ''
    if (result.kind === 'anniversary') {
      const anniversary = result.item
      const ownDate = anniversary.calendar === 'lunar'
        ? `农历 ${anniversary.isLeapMonth ? '闰' : ''}${anniversary.month}月${anniversary.day}日`
        : `${anniversary.month}月${anniversary.day}日`
      return result.nextOccurrence ? `${ownDate} · 下次 ${formatUiDate(result.nextOccurrence)}` : ownDate
    }
    const [year, month, day] = result.date.split('-').map(Number)
    const label = year && month && day ? formatUiDate(new Date(year, month - 1, day)) : result.date
    if (result.kind === 'journal') return result.item.time ? `${label} · ${result.item.time}` : label
    return label
  }

  const inboxTaskMeta = (task: Task) => {
    const tagId = inboxOrdinaryTaskTagId(task)
    const tag = tags.find(item => item.id === tagId)
    const activity = new Date(inboxActivityAt(task))
    const activityText = Number.isNaN(activity.getTime()) ? '时间未知' : activity.toLocaleString([], { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })
    return { tag: tag?.name ?? '默认', tagColor: tag?.color ?? '#9aa29f', activity: `${inboxActivityKind(task) === 'updated' ? '更新' : '创建'} ${activityText}` }
  }

  const searchMarker = (result: SearchResult) => {
    if (result.kind === 'tag') return <span className="search-tag-marker" style={{background:result.item.color}} />
    if (result.kind === 'task') return <span className={`search-task-marker priority-${result.item.priority} status-${result.item.status}`}>{result.item.status === 'completed' ? '✓' : result.item.status === 'abandoned' ? '×' : ''}</span>
    if (result.kind === 'journal') return <span className={`search-journal-marker impact-${result.item.impact}`} />
    return <span className="search-anniversary-marker">{anniversaryIcon(result.item.type)}</span>
  }

  const navigateToCalendarDate = (date:Date, openDetail=true) => {
    const targetMonth=new Date(date.getFullYear(),date.getMonth(),1)
    const dateKey=toDateKey(date)
    setMainView('calendar')
    setVisibleMonth(targetMonth)
    setSelectedDate(date)
    if(isMobileCalendar){
      pendingPrependAnchorRef.current=null
      pendingCalendarScrollRef.current=`date:${dateKey}`
      setMobileCalendarPositionReady(false)
      setMobileActiveMonth(targetMonth)
      setMobileMonths(Array.from({length:7},(_,index)=>new Date(date.getFullYear(),date.getMonth()+index-3,1)))
      dayDetailOriginScrollRef.current=null
    }
    if(openDetail){ cancelDayDetailCloseTimer(); setDayDetailClosing(false); setDayDetailOpen(true) }
  }

  const openTaskAtItsDay = (task:Task) => {
    if (!task.date) { setInboxOpen(false); openTaskDetail(task); return }
    const [year,month,day]=task.date.split('-').map(Number)
    const date=new Date(year,month-1,day)
    navigateToCalendarDate(date)
    setOverdueInboxOpen(false)
    window.setTimeout(()=>openTaskDetail(task),0)
  }

  const openSearchResult = (result: SearchResult) => {
    if (result.kind === 'tag') return
    setSearchOpen(false)
    setMobileSearchVisible(false)
    if (result.kind === 'task' || result.kind === 'journal') {
      const dateKey=result.item.date
      if (result.kind === 'task' && !dateKey) { openTaskDetail(result.item); return }
      const [year,month,day]=(dateKey as string).split('-').map(Number)
      const date=new Date(year,month-1,day)
      navigateToCalendarDate(date)
      window.setTimeout(()=>{
        if(result.kind==='task') openTaskDetail(result.item)
        else setViewingJournalId(result.id)
      },0)
    } else openAnniversaryEditor(result.item)
  }

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
        setMobileSearchVisible(false)
      }
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setMobileSearchVisible(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const statistics = useMemo(() => buildStatistics({
    today, statsRange, weekStartsMonday, activeTasks, activeJournalEntries, dailyMoods, dailyEnergy, managedTags, tags,
    focusSessions, wordCloudIgnored, timerNow, excludeDefaultFocusStats,
  }),[activeTasks,activeJournalEntries,dailyMoods,dailyEnergy,managedTags,tags,focusSessions,statsRange,weekStartsMonday,wordCloudIgnored,timerNow,excludeDefaultFocusStats])

  const statsPercent = (value:number) => `${Math.round(value*100)}%`
  const impactLabel = (value:JournalImpact) => value>0 ? `+${value}` : String(value)
  const moodStatLabels = ['','特别差','有点差','一般','还可以','很高兴']

  const anniversaryPageRows = useMemo(() => buildAnniversaryPageRows(activeAnniversaries, today), [activeAnniversaries])

  const attachmentLifecycle = useMemo(() => buildAttachmentLifecycle(tasks, journalEntries), [tasks, journalEntries])
  const allStoredAttachments = useMemo(() => attachmentLifecycle.map(row => row.attachment), [attachmentLifecycle])
  const activeStoredAttachments = useMemo(() => attachmentLifecycle.filter(row => row.state === 'active').map(row => row.attachment), [attachmentLifecycle])
  const trashedStoredAttachments = useMemo(() => attachmentLifecycle.filter(row => row.state === 'trash').map(row => row.attachment), [attachmentLifecycle])
  const browsedActiveAttachments = storageBrowser ? activeStoredAttachments.filter(item => item.type === storageBrowser) : []
  const browsedTrashedAttachments = storageBrowser ? trashedStoredAttachments.filter(item => item.type === storageBrowser) : []
  const browsedAttachments = [...browsedActiveAttachments, ...browsedTrashedAttachments]
  const libraryImages = allStoredAttachments.filter(item => item.type === 'image')
  const effectiveImageBytes = allStoredAttachments.filter(item => item.type === 'image').reduce((sum,item)=>sum+item.size,0)
  const effectiveAudioBytes = allStoredAttachments.filter(item => item.type === 'audio').reduce((sum,item)=>sum+item.size,0)
  const effectiveAttachmentBytes = effectiveImageBytes + effectiveAudioBytes
  const inspectB2Orphans = async () => {
    if (orphanCleanupBusy) return
    setOrphanCleanupBusy(true)
    try {
      const referencedKeys=referencedAttachmentKeys(tasks, journalEntries)
      const response=await fetch('/api/b2-gc',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action:'preview',referencedKeys})})
      const payload:any=await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(String(payload?.error||`HTTP ${response.status}`))
      const keys:string[]=Array.isArray(payload.orphans)?payload.orphans:[]
      const rows=await Promise.all(keys.map(async key=>{
        try{
          const signedResponse=await fetch(`/api/b2-sign?key=${encodeURIComponent(key)}&method=GET`,{headers:{Accept:'application/json'}})
          const signed:any=await signedResponse.json().catch(()=>({}))
          if(!signedResponse.ok||!signed.url) throw new Error('sign failed')
          const headResponse=await fetch(`/api/b2-sign?key=${encodeURIComponent(key)}&method=HEAD`,{headers:{Accept:'application/json'}})
          const headSigned:any=await headResponse.json().catch(()=>({}))
          let contentType='',size=0
          if(headResponse.ok&&headSigned.url){ const metadata=await fetch(headSigned.url,{method:'HEAD'}); if(metadata.ok){contentType=metadata.headers.get('content-type')||'';size=Number(metadata.headers.get('content-length')||0)||0} }
          return {key,url:String(signed.url),contentType,size}
        }catch{return {key,url:'',contentType:'',size:0}}
      }))
      setOrphanAttachments(rows); setOrphanCleanupOpen(true)
    }catch(error){window.alert(`孤儿附件检查失败：${error instanceof Error?error.message:String(error)}`)}
    finally{setOrphanCleanupBusy(false)}
  }
  const cleanupB2Orphans = async () => {
    if(orphanCleanupBusy||orphanAttachments.length===0)return
    if(!window.confirm(`永久删除这 ${orphanAttachments.length} 个孤儿附件？删除后无法恢复。`))return
    setOrphanCleanupBusy(true)
    try{
      const referencedKeys=referencedAttachmentKeys(tasks,journalEntries)
      const response=await fetch('/api/b2-gc',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action:'delete',referencedKeys,orphanKeys:orphanAttachments.map(item=>item.key)})})
      const payload:any=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(String(payload?.error||`HTTP ${response.status}`))
      await cleanupOrphanAttachmentBlobs(referencedKeys); setStorageStats(await getStorageStats()); setOrphanAttachments([]); setOrphanCleanupOpen(false)
      window.alert(payload.skipped?`已清除 ${payload.deleted} 个；另有 ${payload.skipped} 个因重新获得引用而跳过。`:`已清除 ${payload.deleted} 个 B2 孤儿附件。`)
    }catch(error){window.alert(`孤儿附件清理失败：${error instanceof Error?error.message:String(error)}`)}finally{setOrphanCleanupBusy(false)}
  }
  const chooseLibraryImage = (source: Attachment) => {
    const linked: Attachment = { ...source, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    if (imageLibraryTarget === 'task') {
      setDraft(current => current.attachments.some(a => a.storageKey === source.storageKey) ? current : { ...current, attachments: [...current.attachments, linked] })
    } else if (imageLibraryTarget === 'journal') {
      setJournalDraft(current => {
        if (current.attachments.some(a => a.storageKey === source.storageKey) || current.attachments.filter(a => a.type === 'image').length >= 9) return current
        return { ...current, attachments: [...current.attachments, linked] }
      })
    }
  }

  const openExternalImport = () => {
    setExternalImportOpen(true); setExternalImportStage('sources'); setDidaImportPreview(null); setForestImportPreview(null); setExternalImportMessage('')
  }
  const closeExternalImport = () => {
    if(externalImportBusy) return
    setExternalImportOpen(false); setExternalImportStage('sources'); setDidaImportPreview(null); setForestImportPreview(null); setExternalImportMessage('')
    if(externalImportInputRef.current) externalImportInputRef.current.value=''
  }
  const inspectGenericCsv = async (file:File) => {
    setExternalImportBusy(true); setExternalImportMessage('正在识别通用 CSV…')
    try {
      const text=await file.text(), rows=parseCsvRows(text)
      if(rows.length<2) throw new Error('CSV 中没有可导入的数据')
      const headerIndex=rows.findIndex(row=>{
        const title=genericHeaderIndex(row,['标题','任务','任务名称','title','task','name'])
        const date=genericHeaderIndex(row,['日期','开始日期','任务日期','date','startdate','start'])
        return title>=0 && date>=0
      })
      if(headerIndex<0) throw new Error('至少需要“标题”和“日期”两列')
      const header=rows[headerIndex], sourceRows=rows.slice(headerIndex+1).filter(row=>row.some(cell=>cell.trim()))
      const col={
        id:genericHeaderIndex(header,['taskid','id','任务id']),
        date:genericHeaderIndex(header,['日期','开始日期','任务日期','date','startdate','start']),
        end:genericHeaderIndex(header,['结束日期','enddate','end']),
        title:genericHeaderIndex(header,['标题','任务','任务名称','title','task','name']),
        notes:genericHeaderIndex(header,['描述','备注','笔记','notes','note','description','content']),
        subtask:genericHeaderIndex(header,['子任务','checklist','subtask','subtasks']),
        status:genericHeaderIndex(header,['是否完成','完成','状态','completed','done','status']),
        category:genericHeaderIndex(header,['分类','标签','tags','tag','category','list']),
        priority:genericHeaderIndex(header,['优先级','priority']),
        time:genericHeaderIndex(header,['时间','开始时间','time','starttime']),
      }
      const existingIds=new Set(tasks.map(task=>task.id))
      const tagByName=new Map<string,Tag>(tags.map(tag=>[normalizedTagName(tag.name),tag] as [string,Tag]))
      const importedTags:Tag[]=[]
      let duplicateCount=0, skippedNoDate=0
      const converted:Task[]=[]
      sourceRows.forEach((row,rowIndex)=>{
        const cell=(index:number)=>index>=0?(row[index]??'').trim():''
        const title=cell(col.title); if(!title) return
        const date=genericDate(cell(col.date)); if(!date){skippedNoDate++;return}
        const sourceId=cell(col.id)||`${date}:${title}:${rowIndex+1}`
        const id=`import:generic:${sourceId}`
        if(existingIds.has(id)){duplicateCount++;return}
        const category=cell(col.category)
        const ordinaryTagIds:string[]=[]
        category.split(/[;,，、|]/).map(v=>v.trim()).filter(Boolean).forEach(name=>{
          const key=name.toLowerCase(); let tag=tagByName.get(key)
          if(!tag){
            tag={id:`import:generic:tag:${crypto.randomUUID()}`,name,color:TAG_COLORS[(tagByName.size+importedTags.length)%TAG_COLORS.length],scope:'task',updatedAt:new Date().toISOString()}
            tagByName.set(key,tag); importedTags.push(tag)
          }
          ordinaryTagIds.push(tag.id)
        })
        const tagIds=ordinaryTagIds.length?[ordinaryTagIds[0],EXTERNAL_SOURCE_TAG_ID,GENERIC_SOURCE_TAG_ID]:[DEFAULT_TAG_ID,EXTERNAL_SOURCE_TAG_ID,GENERIC_SOURCE_TAG_ID]
        const statusText=cell(col.status).toLowerCase()
        const completed=['yes','y','true','1','完成','已完成','done','completed'].includes(statusText)
        const abandoned=['放弃','已放弃','abandoned','cancelled','canceled'].includes(statusText)
        const status:TaskStatus=completed?'completed':abandoned?'abandoned':'todo'
        const priorityText=cell(col.priority)
        const p=Number.parseInt(priorityText,10)
        const priority:TaskPriority=Number.isFinite(p)&&p>=0&&p<=3?p as TaskPriority:defaultPriority
        const noteParts=[cell(col.notes),cell(col.subtask)].filter(Boolean)
        const timeRaw=cell(col.time).match(/(\d{1,2}):(\d{2})/)
        const time=timeRaw?`${timeRaw[1].padStart(2,'0')}:${timeRaw[2]}`:undefined
        const endDate=genericDate(cell(col.end))
        const createdAt=`${date}T12:00:00`
        converted.push({
          id,title,date,...(endDate&&endDate!==date?{endDate}:{}),priority,status,allDay:!time,...(time?{time}:{}),
          ...(noteParts.length?{notes:noteParts.join('\n\n')}:{}),
          createdAt,updatedAt:new Date().toISOString(),
          ...(status==='completed'?{completedAt:`${date}T12:00:00`}:{}),
          tagIds
        })
      })
      const requiredSystemTags=[EXTERNAL_SOURCE_TAG,GENERIC_SOURCE_TAG].filter(required=>!tags.some(tag=>tag.id===required.id))
      const finalTags=[...requiredSystemTags,...importedTags]
      setDidaImportPreview({fileName:file.name,total:sourceRows.length,tasks:converted,tags:finalTags,duplicateCount,skippedNoDate,strippedAttachmentCount:0,ignoredChecklistCount:0})
      setExternalImportStage('generic-preview'); setExternalImportMessage('')
    } catch(error) {
      console.error('Failed to inspect generic CSV',error)
      setDidaImportPreview(null); setExternalImportMessage(error instanceof Error?`无法读取：${error.message}`:'无法读取这个文件')
    } finally {
      setExternalImportBusy(false)
      if(externalImportInputRef.current) externalImportInputRef.current.value=''
    }
  }
  const inspectDidaCsv = async (file:File) => {
    setExternalImportBusy(true); setExternalImportMessage('正在解析滴答清单…')
    try {
      const text=await file.text(), rows=parseCsvRows(text)
      const headerIndex=rows.findIndex(row=>row[0]==='Folder Name' && row.includes('Title') && row.includes('taskId'))
      if(headerIndex<0) throw new Error('没有找到滴答清单 CSV 表头')
      const header=rows[headerIndex]
      const sourceRows=rows.slice(headerIndex+1).filter(row=>row.some(cell=>cell.trim()))
      const existingIds=new Set(tasks.map(task=>task.id))
      const tagByName=new Map<string,Tag>(tags.map(tag=>[normalizedTagName(tag.name),tag] as [string,Tag]))
      const importedTags:Tag[]=[]
      let duplicateCount=0, skippedNoDate=0, strippedAttachmentCount=0, ignoredChecklistCount=0
      const converted:Task[]=[]
      sourceRows.forEach((row,rowIndex)=>{
        const get=(name:string)=>row[header.indexOf(name)] ?? ''
        const taskId=get('taskId').trim() || `row-${rowIndex+1}`
        const id=`import:dida:${taskId}`
        if(existingIds.has(id)){ duplicateCount++; return }
        const timezone=get('Timezone') || 'Asia/Shanghai'
        const start=zonedParts(get('Start Date'),timezone), due=zonedParts(get('Due Date'),timezone)
        const base=start ?? due
        if(!base){ skippedNoDate++; return }
        const allDay=get('Is All Day').toLowerCase()==='true'
        const content=cleanDidaContent(get('Content')); strippedAttachmentCount+=content.removed
        if(get('Kind')==='CHECKLIST' || get('Is Check list')==='Y') ignoredChecklistCount++
        const ordinaryTagIds:string[]=[]
        splitImportedTagNames(get('Tags')).forEach(name=>{
          const key=name.toLowerCase()
          let tag=tagByName.get(key)
          if(!tag){
            tag={id:`import:dida:tag:${crypto.randomUUID()}`,name,color:TAG_COLORS[(tagByName.size+importedTags.length)%TAG_COLORS.length],scope:'task',updatedAt:new Date().toISOString()}
            tagByName.set(key,tag); importedTags.push(tag)
          }
          ordinaryTagIds.push(tag.id)
        })
        const tagIds=ordinaryTagIds.length ? [ordinaryTagIds[0],EXTERNAL_SOURCE_TAG_ID,DIDA_APP_SOURCE_TAG_ID] : [DEFAULT_TAG_ID,EXTERNAL_SOURCE_TAG_ID,DIDA_APP_SOURCE_TAG_ID]
        const statusRaw=get('Status')
        const status:TaskStatus=statusRaw==='2'?'completed':statusRaw==='-1'?'abandoned':'todo'
        const priorityRaw=Number.parseInt(get('Priority')||'0',10)
        const priority:TaskPriority=priorityRaw>=5?3:priorityRaw>=3?2:priorityRaw>=1?1:0
        const createdRaw=didaIso(get('Created Time'))
        const completedRaw=didaIso(get('Completed Time'))
        const recurrence=parseDidaRecurrence(get('Repeat'))
        const endDate=due && due.date!==base.date ? due.date : undefined
        converted.push({
          id,title:get('Title').trim() || '未命名任务',date:base.date,...(endDate?{endDate}:{}),priority,status,allDay,
          ...(!allDay?{time:base.time}:{}),
          ...(content.text?{notes:content.text}:{}),
          createdAt:createdRaw && !Number.isNaN(new Date(createdRaw).getTime()) ? new Date(createdRaw).toISOString() : new Date().toISOString(),
          updatedAt:new Date().toISOString(),
          ...(status==='completed' && completedRaw && !Number.isNaN(new Date(completedRaw).getTime())?{completedAt:new Date(completedRaw).toISOString()}:{}),
          tagIds,...(recurrence?{recurrence}:{})
        })
      })
      const requiredSystemTags=[EXTERNAL_SOURCE_TAG,DIDA_APP_SOURCE_TAG].filter(required=>!tags.some(tag=>tag.id===required.id))
      const finalTags=[...requiredSystemTags,...importedTags]
      setDidaImportPreview({fileName:file.name,total:sourceRows.length,tasks:converted,tags:finalTags,duplicateCount,skippedNoDate,strippedAttachmentCount,ignoredChecklistCount})
      setExternalImportStage('dida-preview'); setExternalImportMessage('')
    } catch(error) {
      console.error('Failed to inspect Dida CSV',error)
      setDidaImportPreview(null); setExternalImportMessage(error instanceof Error?`无法读取：${error.message}`:'无法读取这个文件')
    } finally {
      setExternalImportBusy(false)
      if(externalImportInputRef.current) externalImportInputRef.current.value=''
    }
  }
  const inspectForestCsv = async (file:File) => {
    setExternalImportBusy(true); setExternalImportMessage('正在解析 Forest…')
    try {
      const text=await file.text(), rows=parseCsvRows(text)
      const headerIndex=rows.findIndex(row=>row.includes('Start Time')&&row.includes('End Time')&&row.includes('Tag')&&row.includes('Is Success'))
      if(headerIndex<0) throw new Error('没有找到 Forest CSV 表头')
      const header=rows[headerIndex], sourceRows=rows.slice(headerIndex+1).filter(row=>row.some(cell=>cell.trim()))
      const startCol=header.indexOf('Start Time'), endCol=header.indexOf('End Time'), tagCol=header.indexOf('Tag'), successCol=header.indexOf('Is Success')
      const existingIds=new Set(focusSessions.map(session=>session.id))
      const tagByName=new Map<string,Tag>(tags.map(tag=>[normalizedTagName(tag.name),tag] as [string,Tag]))
      const importedTags:Tag[]=[]; const reusedNames=new Set<string>()
      let duplicateCount=0, failedCount=0, invalidCount=0
      const sessions:FocusSession[]=[]
      sourceRows.forEach(row=>{
        const success=(row[successCol]??'').trim().toLowerCase()
        if(success!=='true'){ failedCount++; return }
        const startRaw=(row[startCol]??'').trim(), endRaw=(row[endCol]??'').trim(), forestTag=(row[tagCol]??'').trim()
        const start=forestDate(startRaw), end=forestDate(endRaw)
        if(!start||!end||end.getTime()<start.getTime()){ invalidCount++; return }
        const normalizedForestTag=forestTag&&forestTag!=='未设置'?forestTag:'默认'
        const identity=`${startRaw}|${endRaw}|${forestTag}`
        const id=`import:forest:${stableImportHash(identity)}`
        if(existingIds.has(id)){ duplicateCount++; return }
        existingIds.add(id)
        let ordinaryTag=tagByName.get(normalizedForestTag.toLowerCase())
        if(!ordinaryTag){
          ordinaryTag={id:`import:forest:tag:${stableImportHash(normalizedForestTag.toLowerCase())}`,name:normalizedForestTag,color:TAG_COLORS[(tagByName.size+importedTags.length)%TAG_COLORS.length],scope:'both',updatedAt:new Date().toISOString()}
          tagByName.set(normalizedForestTag.toLowerCase(),ordinaryTag); importedTags.push(ordinaryTag)
        } else if(ordinaryTag.id!==DEFAULT_TAG_ID) reusedNames.add(ordinaryTag.id)
        const startedAt=start.toISOString(), endedAt=end.toISOString()
        sessions.push({id,tagIds:[...new Set([ordinaryTag.id,EXTERNAL_SOURCE_TAG_ID,FOREST_SOURCE_TAG_ID])],mode:'stopwatch',startedAt,endedAt,durationSeconds:Math.max(0,Math.round((end.getTime()-start.getTime())/1000)),createdAt:startedAt,updatedAt:new Date().toISOString()})
      })
      const requiredSystemTags=[EXTERNAL_SOURCE_TAG,FOREST_SOURCE_TAG].filter(required=>!tags.some(tag=>tag.id===required.id))
      setForestImportPreview({fileName:file.name,total:sourceRows.length,sessions,tags:[...requiredSystemTags,...importedTags],duplicateCount,failedCount,invalidCount,createdTagCount:importedTags.length,reusedTagCount:reusedNames.size})
      setExternalImportStage('forest-preview'); setExternalImportMessage('')
    } catch(error) {
      console.error('Failed to inspect Forest CSV',error)
      setForestImportPreview(null); setExternalImportMessage(error instanceof Error?`无法读取：${error.message}`:'无法读取这个文件')
    } finally {
      setExternalImportBusy(false)
      if(externalImportInputRef.current) externalImportInputRef.current.value=''
    }
  }
  const importForestCsv = async () => {
    if(!forestImportPreview || externalImportBusy) return
    setExternalImportBusy(true); setExternalImportMessage('正在导入 Forest 专注记录…')
    try {
      const mergedSessions=[...focusSessions,...forestImportPreview.sessions]
      const existingTagIds=new Set(tags.map(tag=>tag.id))
      const mergedTags=[...tags,...forestImportPreview.tags.filter(tag=>!existingTagIds.has(tag.id))]
      await Promise.all([saveFocusSessions(mergedSessions),saveTags(mergedTags)])
      setFocusSessions(mergedSessions); setTags(mergedTags)
      const imported=forestImportPreview.sessions.length
      setForestImportPreview(null); setExternalImportMessage(`已导入 ${imported} 条 Forest 专注记录`)
      setExternalImportStage('sources')
    } catch(error) {
      console.error('Failed to import Forest CSV',error)
      setExternalImportMessage(error instanceof Error?`导入失败：${error.message}`:'导入失败')
    } finally { setExternalImportBusy(false) }
  }
  const importDidaCsv = async () => {
    if(!didaImportPreview || externalImportBusy) return
    setExternalImportBusy(true); setExternalImportMessage('正在导入…')
    try {
      const mergedTasks=[...tasks,...didaImportPreview.tasks].map(normalizeTaskScheduling)
      const existingTagIds=new Set(tags.map(tag=>tag.id))
      const mergedTags=[...tags,...didaImportPreview.tags.filter(tag=>!existingTagIds.has(tag.id))]
      await Promise.all([saveTasks(mergedTasks),saveTags(mergedTags)])
      setTasks(mergedTasks); setTags(mergedTags)
      const imported=didaImportPreview.tasks.length
      setDidaImportPreview(null); setExternalImportMessage(`已导入 ${imported} 条任务`)
      setExternalImportStage('sources')
    } catch(error) {
      console.error('Failed to import Dida CSV',error)
      setExternalImportMessage(error instanceof Error?`导入失败：${error.message}`:'导入失败')
    } finally { setExternalImportBusy(false) }
  }

  const resetAllUserData = async () => {
    if (resettingData) return
    setResettingData(true); setBackupMessage('正在清空数据…')
    try {
      // Clear user data and create sync tombstones in one IndexedDB transaction.
      // This makes “清空所有数据” a real cross-device deletion on the next GitHub sync.
      await clearZingUserDataWithSync(REQUIRED_SYSTEM_TAGS)
      const cleared: Record<SyncEntityType, any[]> = { task:[], journal:[], mood:[], energy:[], environment:[], period:[], tag:REQUIRED_SYSTEM_TAGS, anniversary:[], focus:[], settings:syncSnapshotsRef.current.settings }
      syncSnapshotsRef.current = cleared
      Object.keys(syncSnapshotReadyRef.current).forEach(key => { syncSnapshotReadyRef.current[key as SyncEntityType] = true })
      setTasks([]); setJournalEntries([]); setDailyMoods([]); setDailyEnergy([]); setDailyEnvironment([]); setMenstrualPeriods([]); setTags(REQUIRED_SYSTEM_TAGS); setAnniversaries([]); setFocusSessions([])
      setLocalWriteRevision(value=>value+1)
      setSelectedDate(today); closeDayDetailImmediately(); setSearchQuery('')
      setResetDataConfirm(false)
      setStorageStats(await getStorageStats())
      setBackupMessage('数据已清空 · 删除将在下次 GitHub 同步传播 · 应用设置已保留')
    } catch (error) {
      console.error('Failed to reset Zing data', error)
      setBackupMessage(error instanceof Error ? `清空失败：${error.message}` : '清空失败')
    } finally { setResettingData(false) }
  }

  const exportTasksCsv = () => {
    const tagName=(id:string)=>tags.find(tag=>tag.id===id)?.name ?? id
    const rows=[
      ['id','title','start_date','end_date','all_day','time','priority','status','deadline','completed_at','original_date','postpone_count','repeat_rule','tags','notes','attachment_count','created_at','updated_at'],
      ...activeTasks.map(task=>[
        task.id,task.title,task.date,task.endDate??'',task.allDay,task.time??'',`P${task.priority}`,task.status,task.deadline??'',task.completedAt??'',task.originalDate??'',
        task.postponeHistory?.length??0,task.recurrence?JSON.stringify(task.recurrence):'',(task.tagIds??[]).map(tagName).join(' | '),task.notes??'',task.attachments?.length??0,task.createdAt,task.updatedAt
      ])
    ]
    const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
    downloadTextFile(`zing-tasks-${toDateKey(new Date())}.csv`,csv,'text/csv;charset=utf-8')
    setBackupMessage(`任务 CSV 已导出 · ${activeTasks.length} 条`)
  }

  const exportJournalsCsv = () => {
    const tagName=(id:string)=>tags.find(tag=>tag.id===id)?.name ?? id
    const rows=[
      ['id','date','time','title','event_impact','tags','body_markdown','image_count','audio_count','created_at','updated_at'],
      ...activeJournalEntries.map(entry=>[
        entry.id,entry.date,entry.time??'',entry.title,entry.impact,(entry.tagIds??[]).map(tagName).join(' | '),entry.content??'',
        (entry.attachments??[]).filter(item=>item.type==='image').length,(entry.attachments??[]).filter(item=>item.type==='audio').length,entry.createdAt,entry.updatedAt
      ])
    ]
    const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
    downloadTextFile(`zing-journals-${toDateKey(new Date())}.csv`,csv,'text/csv;charset=utf-8')
    setBackupMessage(`记录 CSV 已导出 · ${activeJournalEntries.length} 条`)
  }

  const exportFocusCsv = () => {
    const tagById=(id:string)=>tags.find(tag=>tag.id===id)
    const rows=[
      ['id','start_time','end_time','duration_minutes','mode','planned_minutes','tag','source','created_at','updated_at'],
      ...focusSessions.map(session=>{
        const ordinaryTagId=(session.tagIds??[]).find(id=>id===DEFAULT_TAG_ID||!isImportSourceTagId(id)) ?? DEFAULT_TAG_ID
        const ordinaryTag=tagById(ordinaryTagId)
        const sources=(session.tagIds??[]).map(tagById).filter((tag): tag is Tag=>Boolean(tag&&isImportSourceTag(tag))).map(tag=>tag.name)
        return [
          session.id,session.startedAt,session.endedAt??'',Math.round(((session.durationSeconds??0)/60)*100)/100,session.mode,
          session.plannedSeconds==null?'':Math.round((session.plannedSeconds/60)*100)/100,ordinaryTag?.name??ordinaryTagId,sources.length?sources.join(' | '):'Zing',session.createdAt,session.updatedAt
        ]
      })
    ]
    const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
    downloadTextFile(`zing-focus-${toDateKey(new Date())}.csv`,csv,'text/csv;charset=utf-8')
    setBackupMessage(`专注 CSV 已导出 · ${focusSessions.length} 条`)
  }

  const exportAnniversariesCsv = () => {
    const typeLabel=(value:AnniversaryType)=>ANNIVERSARY_TYPES.find(item=>item.value===value)?.label ?? value
    const rows=[
      ['id','title','type','calendar','year','month','day','leap_month','repeat_yearly','notes','created_at','updated_at'],
      ...activeAnniversaries.map(anniversary=>[
        anniversary.id,anniversary.title,typeLabel(anniversary.type),anniversary.calendar,anniversary.year??'',anniversary.month,anniversary.day,
        anniversary.isLeapMonth??false,anniversary.repeatYearly,anniversary.notes??'',anniversary.createdAt,anniversary.updatedAt
      ])
    ]
    const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
    downloadTextFile(`zing-anniversaries-${toDateKey(new Date())}.csv`,csv,'text/csv;charset=utf-8')
    setBackupMessage(`纪念日 CSV 已导出 · ${activeAnniversaries.length} 条`)
  }

  const exportFullBackup = async () => {
    if (backupExporting) return
    setBackupExporting(true); setBackupMessage('正在整理备份…')
    try {
      const encoder=new TextEncoder()
      const json=(value:unknown)=>encoder.encode(JSON.stringify(value,null,2))
      const exportedAt=new Date().toISOString()
      const attachmentRows:{ storageKey:string; path:string; filename:string; mimeType:string; size:number; type:'image'|'audio'; duration?:number; createdAt:string }[]=[]
      const entries:ZipEntry[]=[
        {path:'data/tasks.json',bytes:json(tasks)},
        {path:'data/journals.json',bytes:json(journalEntries)},
        {path:'data/moods.json',bytes:json(dailyMoods)},
        {path:'data/energy.json',bytes:json(dailyEnergy)},
        {path:'data/environment.json',bytes:json(dailyEnvironment)},
        {path:'data/periods.json',bytes:json(menstrualPeriods)},
        {path:'data/tags.json',bytes:json(tags)},
        {path:'data/anniversaries.json',bytes:json(anniversaries)},
        {path:'data/focus.json',bytes:json(focusSessions)},
        {path:'data/settings.json',bytes:json({greeting,weekStart:weekStartsMonday?'monday':'sunday',dateFormat,defaultPriority,showEndedTasks,showAllRecurringTasks,excludeDefaultFocusStats,wordCloudIgnored,encouragementMessages,encouragementStyle,maxFocusHours,weatherOptions,thermalOptions})},
      ]
      for (let index=0; index<allStoredAttachments.length; index+=1) {
        const attachment=allStoredAttachments[index]
        setBackupMessage(`正在读取附件 ${index+1}/${allStoredAttachments.length}…`)
        const blob=await getAttachmentBlob(attachment.storageKey)
        if (!blob) throw new Error(`找不到附件：${attachment.filename}`)
        const base=safeBackupFilename(attachment.filename.replace(/\.[A-Za-z0-9]{1,8}$/,''))
        const path=`attachments/${String(index+1).padStart(4,'0')}-${base}${attachmentExtension(attachment)}`
        entries.push({path,bytes:new Uint8Array(await blob.arrayBuffer())})
        attachmentRows.push({storageKey:attachment.storageKey,path,filename:attachment.filename,mimeType:attachment.mimeType,size:blob.size,type:attachment.type,duration:attachment.duration,createdAt:attachment.createdAt})
      }
      const manifest={format:'zing-calendar-backup',schemaVersion:1,appVersion:APP_VERSION,exportedAt,
        counts:{tasks:tasks.length,journals:journalEntries.length,moods:dailyMoods.length,energies:dailyEnergy.length,environments:dailyEnvironment.length,periods:menstrualPeriods.length,tags:tags.length,anniversaries:anniversaries.length,focusSessions:focusSessions.length,attachments:attachmentRows.length},
        attachments:attachmentRows}
      entries.unshift({path:'manifest.json',bytes:json(manifest)})
      setBackupMessage('正在生成 ZIP…')
      const zip=makeZip(entries), url=URL.createObjectURL(zip), link=document.createElement('a')
      const d=new Date(), stamp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}`
      link.href=url; link.download=`zing-backup-${stamp}.zip`; document.body.appendChild(link); link.click(); link.remove()
      setTimeout(()=>URL.revokeObjectURL(url),1000)
      setBackupMessage(`备份完成 · ${formatBytes(zip.size)}`)
    } catch (error) {
      console.error('Failed to export Zing backup',error)
      setBackupMessage(error instanceof Error ? `备份失败：${error.message}` : '备份失败')
    } finally { setBackupExporting(false) }
  }


  const inspectBackupFile = async (file:File) => {
    setBackupMessage('正在验证备份…')
    try {
      const entries=await readZingZip(file)
      const parsed=parseBackupEntries(entries)
      setBackupPreview({file,...parsed})
      setBackupMessage('')
    } catch(error) {
      console.error('Failed to inspect backup',error)
      setBackupPreview(null); setBackupMessage(error instanceof Error?`备份无效：${error.message}`:'备份无效')
    } finally {
      if (backupInputRef.current) backupInputRef.current.value=''
    }
  }

  const restoreBackup = async () => {
    if (!backupPreview || backupRestoring) return
    setBackupRestoring(true); setBackupMessage('正在恢复数据…')
    try {
      // The archive is fully parsed and validated before any local write begins.
      const restoredTasks = backupPreview.tasks.map(normalizeTaskScheduling)
      await replaceZingData({
        tasks:restoredTasks,journals:backupPreview.journals,moods:backupPreview.moods,energies:backupPreview.energies,environments:backupPreview.environments,periods:backupPreview.periods,
        tags:backupPreview.tags,anniversaries:backupPreview.anniversaries,focusSessions:backupPreview.focusSessions,
        attachments:backupPreview.attachments.map(item=>({key:item.storageKey,blob:new Blob([(() => {
          const copy = new Uint8Array(item.bytes.byteLength)
          copy.set(item.bytes)
          return copy.buffer
        })()],{type:item.mimeType})}))
      })
      const s=backupPreview.settings ?? {}
      if (s.greeting!==undefined) localStorage.setItem('zing:greeting',s.greeting || 'Hello, Zing')
      if (s.weekStart) localStorage.setItem('zing:weekStart',s.weekStart)
      if (s.dateFormat) localStorage.setItem('zing:dateFormat',s.dateFormat)
      if (typeof s.showEndedTasks==='boolean') localStorage.setItem('zing:showEndedTasks',String(s.showEndedTasks))
      if (typeof s.showAllRecurringTasks==='boolean') localStorage.setItem('zing:showAllRecurringTasks',String(s.showAllRecurringTasks))
      if (typeof s.excludeDefaultFocusStats==='boolean') localStorage.setItem('zing:excludeDefaultFocusStats',String(s.excludeDefaultFocusStats))
      if (typeof s.defaultPriority==='number' && s.defaultPriority>=0 && s.defaultPriority<=3) localStorage.setItem('zing:defaultPriority',String(s.defaultPriority))
      if (Array.isArray(s.wordCloudIgnored)) localStorage.setItem('zing:wordCloudIgnored',JSON.stringify(s.wordCloudIgnored))
      if (Array.isArray(s.encouragementMessages)) localStorage.setItem('zing:encouragementMessages',JSON.stringify(s.encouragementMessages))
      if (s.encouragementStyle==='dark'||s.encouragementStyle==='light'||s.encouragementStyle==='random') localStorage.setItem('zing:encouragementStyle',s.encouragementStyle)
      if (typeof s.maxFocusHours==='number') localStorage.setItem('zing:maxFocusHours',String(Math.min(12,Math.max(2,Math.round(s.maxFocusHours)))))
      if (Array.isArray(s.weatherOptions)) localStorage.setItem('zing:weatherOptions',JSON.stringify(s.weatherOptions))
      if (Array.isArray(s.thermalOptions)) localStorage.setItem('zing:thermalOptions',JSON.stringify(s.thermalOptions))
      // Restore is device-local by design. Persist restored settings locally too, but do
      // not create sync changes/tombstones that could roll the cloud back.
      const restoredAt=new Date().toISOString()
      const restoredWords=Array.isArray(s.wordCloudIgnored)?s.wordCloudIgnored:wordCloudIgnored
      const restoredSettings:SyncedUserSettings={
        id:'settings',updatedAt:restoredAt,greeting:s.greeting??greeting,
        weekStart:s.weekStart??(weekStartsMonday?'monday':'sunday'),dateFormat:s.dateFormat??dateFormat,
        defaultPriority:s.defaultPriority??defaultPriority,showEndedTasks:s.showEndedTasks??showEndedTasks,
        showAllRecurringTasks:s.showAllRecurringTasks??showAllRecurringTasks,excludeDefaultFocusStats:s.excludeDefaultFocusStats??excludeDefaultFocusStats,
        wordCloudIgnored:restoredWords,wordCloudIgnoredAddedAt:Object.fromEntries(restoredWords.map(word=>[word.trim().toLowerCase(),restoredAt])),wordCloudIgnoredRemovedAt:{},
        encouragementMessages:Array.isArray(s.encouragementMessages)?s.encouragementMessages:encouragementMessages,
        encouragementStyle:(s.encouragementStyle==='dark'||s.encouragementStyle==='light'||s.encouragementStyle==='random')?s.encouragementStyle:encouragementStyle,
        maxFocusHours:typeof s.maxFocusHours==='number'?Math.min(12,Math.max(2,Math.round(s.maxFocusHours))):maxFocusHours,
        weatherOptions:Array.isArray(s.weatherOptions)?s.weatherOptions:weatherOptions, thermalOptions:Array.isArray(s.thermalOptions)?s.thermalOptions:thermalOptions,
      }
      await saveUserSettings([restoredSettings])
      settingsWordClockRef.current={added:{...(restoredSettings.wordCloudIgnoredAddedAt??{})},removed:{}}
      syncSnapshotsRef.current = { task:restoredTasks, journal:backupPreview.journals, mood:backupPreview.moods, energy:backupPreview.energies, environment:backupPreview.environments, period:backupPreview.periods, tag:backupPreview.tags, anniversary:backupPreview.anniversaries, focus:backupPreview.focusSessions, settings:[restoredSettings] }
      Object.keys(syncSnapshotReadyRef.current).forEach(key => { syncSnapshotReadyRef.current[key as SyncEntityType] = true })
      setTasks(restoredTasks); setJournalEntries(backupPreview.journals); setDailyMoods(backupPreview.moods); setDailyEnergy(backupPreview.energies); setDailyEnvironment(backupPreview.environments); setMenstrualPeriods(backupPreview.periods)
      setTags(normalizeTags(backupPreview.tags)); setAnniversaries(backupPreview.anniversaries); setFocusSessions(backupPreview.focusSessions)
      suppressNextSettingsSyncRef.current = true
      if (s.greeting!==undefined) setGreeting(s.greeting || 'Hello, Zing')
      if (s.weekStart) setWeekStartsMonday(s.weekStart==='monday')
      if (s.dateFormat) setDateFormat(s.dateFormat)
      if (typeof s.defaultPriority==='number' && s.defaultPriority>=0 && s.defaultPriority<=3) setDefaultPriority(s.defaultPriority as TaskPriority)
      if (typeof s.showEndedTasks==='boolean') setShowEndedTasks(s.showEndedTasks)
      if (typeof s.showAllRecurringTasks==='boolean') setShowAllRecurringTasks(s.showAllRecurringTasks)
      if (typeof s.excludeDefaultFocusStats==='boolean') setExcludeDefaultFocusStats(s.excludeDefaultFocusStats)
      if (Array.isArray(s.wordCloudIgnored)) setWordCloudIgnored(s.wordCloudIgnored)
      if (Array.isArray(s.encouragementMessages)) setEncouragementMessages(s.encouragementMessages)
      if (s.encouragementStyle==='dark'||s.encouragementStyle==='light'||s.encouragementStyle==='random') setEncouragementStyle(s.encouragementStyle)
      if (typeof s.maxFocusHours==='number') setMaxFocusHours(Math.min(12,Math.max(2,Math.round(s.maxFocusHours))))
      if (Array.isArray(s.weatherOptions)) setWeatherOptions(normalizeEnvironmentOptions(s.weatherOptions,DEFAULT_WEATHER_OPTIONS))
      if (Array.isArray(s.thermalOptions)) setThermalOptions(normalizeEnvironmentOptions(s.thermalOptions,DEFAULT_THERMAL_OPTIONS))
      setBackupPreview(null); setBackupMessage('恢复完成')
      setStorageStats(await getStorageStats())
    } catch(error) {
      console.error('Failed to restore backup',error)
      setBackupMessage(error instanceof Error?`恢复失败：${error.message}`:'恢复失败')
    } finally { setBackupRestoring(false) }
  }


  const executeGithubSync = async (automatic = false) => {
    if (!githubSyncOwner.trim() || !githubSyncRepo.trim() || !githubSyncBranch.trim()) {
      setGithubSyncMessageKind('error')
      setGithubSyncMessage('请先填写 GitHub 用户名、数据仓库和分支。')
      return
    }
    if (!githubSyncToken.trim()) {
      setGithubSyncMessageKind('error')
      setGithubSyncMessage('请输入本设备的 GitHub Token。Token 不会保存到 Zing 数据或备份中。')
      return
    }
    setGithubSyncBusy(true)
    setGithubSyncMessageKind('working')
    setGithubSyncMessage('正在连接 GitHub…')
    try {
      const result = await syncWithGitHub({
        owner: githubSyncOwner.trim(),
        repo: githubSyncRepo.trim(),
        branch: githubSyncBranch.trim(),
        token: githubSyncToken.trim(),
      })
      await saveGitHubDeviceCredential(githubSyncToken.trim())
      setGithubTokenSaved(true)
      const stamp = result.finishedAt
      setLastGithubSyncAt(stamp)
      localStorage.setItem('zing:lastGithubSyncAt', stamp)
      setGithubSyncMessageKind('success')
      setGithubSyncMessage(result.attachmentWarning
        ? `✓ GitHub 数据同步完成 · ⚠ 附件同步失败：${result.attachmentWarning}`
        : result.initializedRemote
          ? `✓ 首次同步完成 · 云端现有 ${result.pushedRecords} 条数据 · ${result.attachments.total} 个附件`
          : `✓ 同步完成 · 云端现有 ${result.pushedRecords} 条数据 · ${result.attachments.total} 个附件${result.attachments.missing ? ` · ⚠ ${result.attachments.missing} 个附件缺失` : ''}`)
      if (automatic) setAutoSyncToast('✓ 今日首次修改已自动同步')
      // Rehydrate merged records so remote changes become visible immediately.
      const [nextTasks,nextJournals,nextMoods,nextEnergy,nextEnvironment,nextPeriods,nextTags,nextAnniversaries,nextFocusSessions,nextSettings] = await Promise.all([
        loadTasks<Task>(), loadJournalEntries<JournalEntry>(), loadDailyMoods<DailyMood>(), loadDailyEnergy<DailyEnergy>(), loadDailyEnvironment<DailyEnvironment>(), loadMenstrualPeriods<MenstrualPeriod>(), loadTags<Tag>(), loadAnniversaries<Anniversary>(), loadFocusSessions<FocusSession>(), loadUserSettings<SyncedUserSettings>()
      ])
      const normalizedNextTasks = nextTasks.map(normalizeTaskScheduling)
      if (JSON.stringify(normalizedNextTasks) !== JSON.stringify(nextTasks)) await saveTasks(normalizedNextTasks)
      const normalizedNextTags = normalizeTags(nextTags)
      const hydratedTags = ensureRequiredSystemTags(normalizedNextTags)
      const missingSystemTags = hydratedTags.filter(tag => !normalizedNextTags.some(existing => existing.id === tag.id))
      if (missingSystemTags.length) {
        // Persist self-healed schema tags and mark them as upserts so the next
        // GitHub write repairs the cloud tag store instead of losing them again.
        await saveTags(hydratedTags)
        await recordSyncDiff('tag', normalizedNextTags, hydratedTags)
      }
      // Remote merge is hydration, not a local user edit. Reset the diff baselines
      // before React state changes so pulled records/deletes do not generate fresh tombstones.
      syncSnapshotsRef.current = {
        task: normalizedNextTasks,
        journal: nextJournals,
        mood: nextMoods,
        energy: nextEnergy,
        environment: nextEnvironment,
        period: nextPeriods,
        tag: hydratedTags,
        anniversary: nextAnniversaries,
        focus: nextFocusSessions,
        settings: nextSettings,
      }
      syncSnapshotReadyRef.current = { task:true, journal:true, mood:true, energy:true, environment:true, period:true, tag:true, anniversary:true, focus:true, settings:true }
      setTasks(normalizedNextTasks); setJournalEntries(nextJournals); setDailyMoods(nextMoods); setDailyEnergy(nextEnergy); setDailyEnvironment(nextEnvironment); setMenstrualPeriods(nextPeriods)
      setTags(hydratedTags)
      setAnniversaries(nextAnniversaries)
      setFocusSessions(nextFocusSessions)
      const syncedSettings = nextSettings[0]
      if (syncedSettings) {
        settingsWordClockRef.current=hydrateWordClock(syncedSettings, new Date().toISOString())
        const incoming=normalizedIncomingSettings(syncedSettings)
        suppressNextSettingsSyncRef.current = true
        localStorage.setItem('zing:greeting',incoming.greeting)
        localStorage.setItem('zing:weekStart',incoming.weekStartsMonday?'monday':'sunday')
        localStorage.setItem('zing:dateFormat',incoming.dateFormat)
        localStorage.setItem('zing:defaultPriority',String(incoming.defaultPriority))
        localStorage.setItem('zing:showEndedTasks',String(incoming.showEndedTasks))
        localStorage.setItem('zing:showAllRecurringTasks',String(incoming.showAllRecurringTasks))
        localStorage.setItem('zing:excludeDefaultFocusStats',String(incoming.excludeDefaultFocusStats))
        localStorage.setItem('zing:wordCloudIgnored',JSON.stringify(incoming.wordCloudIgnored))
        localStorage.setItem('zing:encouragementMessages',JSON.stringify(incoming.encouragementMessages))
        localStorage.setItem('zing:encouragementStyle',incoming.encouragementStyle)
        localStorage.setItem('zing:maxFocusHours',String(incoming.maxFocusHours))
        setGreeting(incoming.greeting); setWeekStartsMonday(incoming.weekStartsMonday); setDateFormat(incoming.dateFormat); setDefaultPriority(incoming.defaultPriority); setShowEndedTasks(incoming.showEndedTasks); setShowAllRecurringTasks(incoming.showAllRecurringTasks); setExcludeDefaultFocusStats(incoming.excludeDefaultFocusStats); setWordCloudIgnored(incoming.wordCloudIgnored); setEncouragementMessages(incoming.encouragementMessages); setEncouragementStyle(incoming.encouragementStyle); setMaxFocusHours(incoming.maxFocusHours); setWeatherOptions(incoming.weatherOptions); setThermalOptions(incoming.thermalOptions)
      }
    } catch (error) {
      setGithubSyncMessageKind('error')
      setGithubSyncMessage(`同步失败 · ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setGithubSyncBusy(false)
    }
  }

  const switchMainView = (view: 'calendar' | 'statistics' | 'anniversaries' | 'settings') => {
    if (view === 'calendar' && isMobileCalendar) {
      // A calendar entry is a fresh navigation to Today. Reset the finite month
      // window before mounting the page so the IntersectionObserver cannot inherit
      // an old off-screen window and prepend progressively older months.
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      pendingPrependAnchorRef.current = null
      pendingCalendarScrollRef.current = `date:${toDateKey(today)}`
      setMobileCalendarPositionReady(false)
      setVisibleMonth(currentMonth)
      setMobileActiveMonth(currentMonth)
      setMobileMonths(Array.from({length:7}, (_,index) => new Date(today.getFullYear(), today.getMonth() + index - 3, 1)))
    } else if (view !== 'calendar') {
      // Pending calendar navigation must never survive on another top-level page.
      pendingCalendarScrollRef.current = null
      pendingPrependAnchorRef.current = null
      setMobileCalendarPositionReady(false)
    }
    setMainView(view)
    // Bottom navigation changes the top-level page. Do not reuse the document
    // scroll position from the previous page; calendar-internal restoration is separate.
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
  }

  const runGithubSync = async (automatic = false) => {
    if (automatic) return executeGithubSync(true)
    if (!githubSyncOwner.trim() || !githubSyncRepo.trim() || !githubSyncBranch.trim()) {
      setGithubSyncMessageKind('error'); setGithubSyncMessage('请先填写 GitHub 用户名、数据仓库和分支。'); return
    }
    if (!githubSyncToken.trim()) {
      setGithubSyncMessageKind('error'); setGithubSyncMessage('请输入本设备的 GitHub Token。Token 不会保存到 Zing 数据或备份中。'); return
    }
    setGithubSyncBusy(true); setGithubSyncMessageKind('working'); setGithubSyncMessage('正在比较本机与服务器…')
    try {
      const preview = await previewGitHubSync({owner:githubSyncOwner.trim(),repo:githubSyncRepo.trim(),branch:githubSyncBranch.trim(),token:githubSyncToken.trim()})
      setGithubSyncPreview(preview)
      setGithubSyncMessageKind('idle'); setGithubSyncMessage('')
    } catch (error) {
      setGithubSyncMessageKind('error'); setGithubSyncMessage(`同步检查失败 · ${error instanceof Error ? error.message : '未知错误'}`)
    } finally { setGithubSyncBusy(false) }
  }

  useEffect(() => {
    if (!autoSyncToast) return
    const timer = window.setTimeout(() => setAutoSyncToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [autoSyncToast])

  useEffect(() => {
    if (!encouragementReward) return
    const timer = window.setTimeout(() => setEncouragementReward(''), 4800)
    return () => window.clearTimeout(timer)
  }, [encouragementReward])

  useEffect(() => {
    if (localWriteRevision === 0 || githubSyncBusy || !githubSyncToken.trim()) return
    const todayKey = toDateKey(new Date())
    if (localStorage.getItem('zing:lastAutoSyncDate') === todayKey) return
    // Claim today's single automatic attempt before starting. A failed attempt is not retried automatically.
    localStorage.setItem('zing:lastAutoSyncDate', todayKey)
    void runGithubSync(true)
  }, [localWriteRevision, githubSyncBusy, githubSyncToken])

  return (
    <main className="app-shell">
      <header className={`topbar${mainView==='calendar'?' calendar-topbar':''}`}>
        {mainView!=='settings' && <div className={`brand-block${mobileSearchVisible ? " search-open" : ""}`}>
          <button className="brand-mark" type="button" aria-label="打开或收起搜索" aria-expanded={mobileSearchVisible} onClick={()=>{setMobileSearchVisible(current=>!current);setSearchOpen(false)}}><span className="brand-mark-desktop">Z</span><span className="brand-mark-mobile" aria-hidden="true">🔍</span></button>
          <div className="brand-copy">
            <p>{greeting}</p>
          </div>
        </div>}

        {mobileSearchVisible && <button className="mobile-search-backdrop" type="button" aria-label="关闭搜索" onClick={()=>{setMobileSearchVisible(false);setSearchOpen(false)}} />}
        <div className={`global-search-wrap${mobileSearchVisible ? ' mobile-open' : ''}`} ref={searchWrapRef}>
          <span className="global-search-icon">⌕</span>
          <input value={searchQuery} onFocus={() => setSearchOpen(true)} onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }} placeholder="搜索任务、记录、纪念日；#标签…" aria-label="全局搜索" />
          {searchQuery && <button type="button" className="search-clear" onClick={() => setSearchQuery('')} aria-label="清空搜索">×</button>}
          {searchOpen && normalizedSearch && (
            <div className="search-panel">
              {tagSearchMode ? <div className="search-tag-mode"># 标签搜索</div> : <div className="search-filters">
                {([['all','全部'],['task','任务'],['journal','记录'],['anniversary','纪念日']] as const).map(([value,label]) => <button key={value} type="button" className={searchFilter===value?'active':''} onClick={() => setSearchFilter(value)}>{label}</button>)}
              </div>}
              <div className="search-results">
                {searchResults.length === 0 ? <p className="search-empty">没有找到结果。</p> : searchResults.map(result => (
                  <button key={`${result.kind}-${result.id}`} type="button" className={`search-result${result.kind==='tag'?' tag-search-result':''}`} onClick={() => openSearchResult(result)} disabled={result.kind==='tag'}>
                    <span className={`search-kind kind-${result.kind}`}>{searchMarker(result)}</span>
                    <span className="search-result-main"><strong>{result.kind==='tag' ? result.title : highlightSearch(result.title)}</strong>{result.snippet && <small>{result.kind==='tag' ? result.snippet : highlightSearch(result.snippet)}</small>}</span>
                    {result.kind!=='tag' && <time>{searchDateLabel(result)}</time>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {mainView === 'calendar' && <section className={`calendar-card${isMobileCalendar && dayDetailOpen ? ' day-detail-open' : ''}`} aria-label="月历">
        <div className="calendar-sticky-header">
        <div className="calendar-toolbar">
          <div className="month-navigation">
            <button className="nav-button" type="button" onClick={() => moveMonth(-1)} aria-label="上个月">‹</button>
            <button className="month-title-button" type="button" onClick={()=>openMonthPicker('calendar')} aria-label="快速选择年月">{MONTHS[(isMobileCalendar?mobileActiveMonth:visibleMonth).getMonth()]} {(isMobileCalendar?mobileActiveMonth:visibleMonth).getFullYear()} <span>⌄</span></button>
            <button className="nav-button" type="button" onClick={() => moveMonth(1)} aria-label="下个月">›</button>
            <button className="today-button" type="button" onClick={goToday}>Today</button>
            <button className={`focus-trigger${activeFocusSession?' running':''}`} type="button" onClick={()=>{if(!activeFocusSession){const last=[...activeFocusSessions(focusSessions)].filter(item=>item.endedAt).sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];const lastOrdinary=last?.tagIds.find(id=>id===DEFAULT_TAG_ID||(!isImportSourceTagId(id)&&tags.some(tag=>tag.id===id&&!tag.archived&&(tag.scope==='both'||tag.scope==='task'))));setFocusTagIds([lastOrdinary??DEFAULT_TAG_ID])}setFocusOpen(true)}}>{activeFocusSession?`专注 ${formatClock(activeFocusSession.mode==='countdown'?activeFocusRemaining:activeFocusElapsed)}`:'开始专注'}</button>
          </div>
          <div className="calendar-status-controls">
            <button className="trash-inbox-trigger inbox-trigger" type="button" onClick={()=>setInboxOpen(true)} aria-label={`打开收集箱，共 ${inboxTasks.length} 条`}><svg className="inbox-trigger-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15l1.5 11.5a2 2 0 0 1-2 2.3H5a2 2 0 0 1-2-2.3L4.5 5.5Z"/><path d="M4 14h4.2l1.4 2h4.8l1.4-2H20"/></svg><span>收集箱{inboxTasks.length?` ${compactCount(inboxTasks.length)}`:''}</span></button>
            <button className="trash-inbox-trigger" type="button" onClick={()=>setTrashOpen(true)} aria-label={trashItems.length?`打开回收站，共 ${trashItems.length} 条`:'打开回收站，当前为空'}><svg className="trash-trigger-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg><span>回收站</span></button>
            {overdueTasks.length>0 && <button className={`overdue-inbox-trigger${overdueTasks.length>=5?' urgent':''}`} type="button" onClick={()=>setOverdueInboxOpen(true)} aria-label={`打开已逾期任务，共 ${overdueTasks.length} 条`}><span>⚠</span> 已逾期 {compactCount(overdueTasks.length)}</button>}
            {endedTasksViewToggle('calendar-ended-toggle')}
            <button className="program-refresh-button" type="button" onClick={()=>void refreshProgram()} disabled={programRefreshBusy} aria-label="检查并刷新程序" title="检查并刷新程序">{programRefreshBusy?'…':'↻'}</button>
          </div>
        </div>

        <div className="weekday-row">
          {displayWeekdays.map(day => <div key={day}>{day}</div>)}
        </div>
        </div>

        {isMobileCalendar ? <>
          <div className="continuous-calendar" ref={continuousCalendarRef}>
            {continuousCalendarContent}
          </div>
        </> : renderCalendarMonthGrid(visibleMonth)}
      </section>}

      {mainView === 'statistics' && (
        <section className="statistics-page">
          <div className="page-heading stats-heading">
            <div><span className="eyebrow">STATISTICS</span><h2>统计</h2></div>
          </div>
          <div className="stats-range" role="group" aria-label="统计时间范围">
            {([['week','本周'],['month','本月'],['30d','近30天'],['year','今年'],['all','全部']] as const).map(([value,label])=>
              <button type="button" key={value} className={statsRange===value?'active':''} onClick={()=>setStatsRange(value)}>{label}</button>
            )}
          </div>

          <div className="stats-overview">
            <div className="stat-number-card"><span>完成任务</span><strong>{statistics.completed}</strong><small>{statistics.eligibleTasks.length} 个已进入执行期</small></div>
            <div className="stat-number-card"><span>完成率</span><strong>{statistics.eligibleTasks.length?statsPercent(statistics.completionRate):'—'}</strong><small>{statistics.eligibleTasks.length?`${statistics.completed} / ${statistics.eligibleTasks.length}`:'暂无可统计任务'}</small></div>
            <div className="stat-number-card"><span>记录</span><strong>{statistics.journals.length}</strong><small>{statistics.journalDays} 天写过 Journal</small></div>
            <div className="stat-number-card"><span>心情记录</span><strong>{statistics.moodDays}</strong><small>Daily Mood 天数</small></div>
          </div>

          <section className="stats-section">
            <div className="stats-section-title"><div><span className="eyebrow">TASKS</span><h3>任务</h3></div></div>
            <div className="stats-inline-cards">
              <div><span>完成</span><strong>{statistics.completed}</strong></div>
              <div><span>放弃</span><strong>{statistics.abandoned}</strong></div>
              <div><span>逾期待办</span><strong>{statistics.overdue}</strong></div>
            </div>
            {statistics.eligibleTasks.length ? <>
              <div className="stats-subblock"><h4>优先级分布</h4>
                <div className="stat-bars">{statistics.priorityCounts.map(row=><div className={`stat-bar-row priority-stat-${row.value}`} key={row.value}><span>P{row.value}</span><div><i style={{width:`${row.count/statistics.eligibleTasks.length*100}%`}} /></div><strong>{row.count}</strong></div>)}</div>
              </div>
              <div className="postpone-summary">
                <div><span>延期率</span><strong>{statsPercent(statistics.postponeRate)}</strong><small>{statistics.postponedTasks} / {statistics.eligibleTasks.length} 个任务</small></div>
                <div><span>延期总次数</span><strong>{statistics.postponeEvents}</strong></div>
                <div><span>单任务最多</span><strong>{statistics.maxPostponeCount} 次</strong></div>
                <div><span>最长累计延期</span><strong>{statistics.maxPostponeDays} 天</strong></div>
              </div>
            </> : <p className="page-empty compact">这个时间范围还没有进入执行期的任务，暂不统计优先级与延期。</p>}
            {statistics.mostPostponedTag && <div className="most-postponed-tag">
              <span>最常延期标签</span><strong>#{statistics.mostPostponedTag.tag.name}</strong>
              <small>{statsPercent(statistics.mostPostponedTag.postponeRate)} · {statistics.mostPostponedTag.postponeTasks}/{statistics.mostPostponedTag.tasks}个任务</small>
            </div>}
            {(statistics.maxPostponeCount>0||statistics.maxPostponeDays>0) && <div className="postpone-extremes">
              {statistics.maxPostponeCount>0 && statistics.mostPostponedTask && <span>延期次数最多：<strong>{statistics.mostPostponedTask.title}</strong> · {statistics.maxPostponeCount}次</span>}
              {statistics.maxPostponeDays>0 && statistics.longestPostponedTask && <span>累计延期最长：<strong>{statistics.longestPostponedTask.title}</strong> · {statistics.maxPostponeDays}天</span>}
            </div>}
            <div className="stats-subblock">
              <h4>完成趋势</h4>
              {statistics.completionTrend.length ? <div className="completion-chart-wrap">
                <div className="completion-trend">
                  {statistics.completionTrend.map((item,index)=>{
                    const max=Math.max(...statistics.completionTrend.map(x=>x.count),1)
                    const labelEvery=Math.max(1,Math.ceil(statistics.completionTrend.length/8))
                    const showLabel=index===0||index===statistics.completionTrend.length-1||index%labelEvery===0
                    return <div key={item.key} title={`${item.key} · 完成 ${item.count}`}>
                      <span className={`completion-count${showLabel?' show-mobile-count':''}`}>{item.count}</span>
                      <i style={{height:`${Math.max(8,item.count/max*100)}%`}} />
                      <span className="completion-date">{showLabel?item.label:''}</span>
                    </div>
                  })}
                </div>
              </div> : <p className="page-empty compact">这个时间范围还没有完成记录。</p>}
            </div>

          </section>


          <section className="stats-section focus-section">
            <div className="stats-section-title"><div><span className="eyebrow">FOCUS</span><h3>专注</h3></div><small>{formatFocusDuration(statistics.focusSeconds)}</small></div>
            <div className="stats-subblock focus-stats-block">
              <div className="focus-stats-heading"><h4>专注时间</h4><div className="focus-stats-heading-actions"><label className="ended-view-toggle focus-default-toggle"><input type="checkbox" checked={excludeDefaultFocusStats} onChange={event=>setExcludeDefaultFocusStats(event.target.checked)} /><i /><span>排除默认标签</span></label><strong>{formatFocusDuration(statistics.focusSeconds)}</strong></div></div>
              {statistics.focusTrend.length ? <div className="completion-chart-wrap">
                <div className="completion-trend focus-trend">
                  {statistics.focusTrend.map((item,index)=>{
                    const max=Math.max(...statistics.focusTrend.map(x=>x.seconds),1)
                    const labelEvery=Math.max(1,Math.ceil(statistics.focusTrend.length/8))
                    const showLabel=index===0||index===statistics.focusTrend.length-1||index%labelEvery===0
                    return <div key={item.key} title={`${item.key} · 专注 ${formatFocusDuration(item.seconds)}`}>
                      <span className={`completion-count${showLabel?' show-mobile-count':''}`}>{item.seconds >= 60 ? `${Math.floor(item.seconds/60)}m` : item.seconds > 0 ? '<1m' : '0'}</span>
                      <i style={{height:`${Math.max(8,item.seconds/max*100)}%`}} />
                      <span className="completion-date">{showLabel?item.label:''}</span>
                    </div>
                  })}
                </div>
              </div> : <p className="page-empty compact">这个时间范围还没有专注记录。</p>}
              {statistics.focusColorRows.length>0 && <div className="focus-distribution">
                <div className="focus-pie-wrap"><div className="focus-pie" style={{background:statistics.focusPieGradient}} aria-label="按标签颜色汇总的专注时间分布"><i><b>{formatFocusDuration(statistics.focusSeconds)}</b><small>总专注</small></i>{statistics.focusPieLabels.map(row=><span key={row.color} className="focus-pie-percent" style={{left:`${row.x}%`,top:`${row.y}%`}}>{Math.round(row.percent)}%</span>)}</div></div>
                <div className="focus-color-stats">
                {statistics.focusColorRows.map(row=><div className="focus-color-block" key={row.color}><button type="button" onClick={()=>setExpandedFocusColor(current=>current===row.color?null:row.color)}><span><i style={{background:row.color}} />{formatFocusDuration(row.seconds)}</span><strong>{row.percent.toFixed(row.percent>=10?0:1)}%</strong><b>{expandedFocusColor===row.color?'⌃':'›'}</b></button>{expandedFocusColor===row.color&&<div className="focus-color-detail">{row.tags.sort((a,b)=>b.seconds-a.seconds).map(tagRow=><div key={tagRow.tag.id}><span><i style={{background:tagRow.tag.color}} />{tagRow.tag.name}</span><strong>{formatFocusDuration(tagRow.seconds)}</strong><small>{row.seconds?`${(tagRow.seconds/row.seconds*100).toFixed(1)}%`:''}</small></div>)}</div>}</div>)}
                </div>
              </div>}
            </div>
          </section>
          <section className="stats-section">
            <div className="stats-section-title"><div><span className="eyebrow">JOURNAL</span><h3>记录与事件影响</h3></div><small>{statistics.journals.length} 篇 · {statistics.journalDays} 天</small></div>
            <div className="impact-distribution">
              {statistics.journals.length ? statistics.impactCounts.map(row=><div key={row.value} className={`impact-stat impact-${row.value<0?'negative':row.value>0?'positive':'neutral'}`}><span>{impactLabel(row.value)}</span><strong>{row.count}</strong></div>) : <p className="page-empty compact">这个时间范围还没有 Journal，暂不统计 Event Impact。</p>}
            </div>
            <div className="stats-subblock"><h4>词云</h4><p className="stats-note">来自当前时间范围内 Journal 的标题与正文；字体越大，出现越频繁。点击词语可屏蔽。</p>
              {statistics.words.length ? <div className="journal-word-cloud">{statistics.words.map(({word,count},index)=>{
                const max=statistics.words[0]?.count||1
                const frequencyScale=Math.sqrt(count/max)
                const rankScale=Math.max(.46,1-index/70)
                const size=12+Math.round(26*frequencyScale*rankScale)
                if(index===0) return <button type="button" className="word-cloud-center word-cloud-word" key={word} style={{fontSize:`${Math.max(38,size)}px`}} title={`${count} 次 · 点击屏蔽`} onClick={()=>setWordCloudIgnored(list=>list.includes(word)?list:[...list,word])}>{word}</button>
                const angle=index*2.399963229728653
                const radius=Math.min(43,10+Math.sqrt(index)*7.2)
                const left=50+Math.cos(angle)*radius
                const top=50+Math.sin(angle)*radius*.78
                return <button type="button" className="word-cloud-word" key={word} style={{fontSize:`${size}px`,left:`${left}%`,top:`${top}%`}} title={`${count} 次 · 点击屏蔽`} onClick={()=>setWordCloudIgnored(list=>list.includes(word)?list:[...list,word])}>{word}</button>
              })}</div> : <p className="page-empty compact">还没有足够的文字。</p>}
            </div>
          </section>

          <section className="stats-section">
            <div className="stats-section-title"><div><span className="eyebrow">STATUS</span><h3>状态</h3></div><small>{statistics.statusDays} 天</small></div>
            {(statsRange==='year'||statsRange==='all') && (
              <div className="status-summary-groups">
                <div className="status-summary-group"><strong className="status-summary-label">心情</strong><div className="mood-stat-list">{statistics.moodCounts.map(row=><div key={`mood-${row.value}`}><span className="mood-stat-face"><MoodFace level={row.value} /></span><span>{moodStatLabels[row.value]}</span><strong>{row.count}</strong></div>)}</div></div>
                <div className="status-summary-group"><strong className="status-summary-label">能量</strong><div className="mood-stat-list energy-stat-list">{statistics.energyCounts.map(row=><div key={`energy-${row.value}`}><span className="energy-stat-icon"><EnergyBattery level={row.value} /></span><span>{ENERGIES.find(item=>item.value===row.value)?.label}</span><strong>{row.count}</strong></div>)}</div></div>
              </div>
            )}
            {(statsRange==='year'||statsRange==='all') ? (
              <div className="mood-heatmap-wrap status-heatmaps">
                {(() => {
                  const years=statistics.allHeatmapYears
                  const selected=years.find(group=>group.year===moodHeatmapYear) ?? years[years.length-1]
                  if(!selected) return <p className="page-empty compact">还没有状态记录。</p>
                  const index=Math.max(0,years.findIndex(group=>group.year===selected.year))
                  const heatmap=(kind:'mood'|'energy') => <div className="status-heatmap-block">
                    <strong>{kind==='mood'?'心情':'能量'}</strong>
                    <div className="mood-year-heatmap status-year-heatmap" ref={element=>{if(element && window.innerWidth<=620) requestAnimationFrame(()=>{element.scrollLeft=element.scrollWidth})}}>
                      {Array.from({length:selected.leading}).map((_,i)=><i key={`${kind}-blank-${selected.year}-${i}`} className="heatmap-blank" />)}
                      {selected.days.map(day=>{
                        const level=kind==='mood'?day.level:day.energyLevel
                        const label=kind==='mood'?(level?moodStatLabels[level]:'未记录'):(level?ENERGIES.find(item=>item.value===level)?.label:'未记录')
                        return <i key={`${kind}-${day.key}`} title={`${day.key} · ${label}`} className={`${level?`mood-${level}`:''}${day.future?' future':''}`} />
                      })}
                    </div>
                  </div>
                  return <div className="mood-single-year-wrap">
                    <div className="mood-heatmap-year status-heatmap-year">
                      <span>{selected.year}</span>
                      {heatmap('mood')}
                      {heatmap('energy')}
                    </div>
                    {years.length>1&&<div className="mood-year-navigator" onWheel={event=>{
                      if(Math.abs(event.deltaY)+Math.abs(event.deltaX)<8) return
                      const direction=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)>0?1:-1
                      const next=Math.max(0,Math.min(years.length-1,index+direction))
                      if(next!==index)setMoodHeatmapYear(years[next].year)
                    }}>
                      <button type="button" disabled={index<=0} onClick={()=>index>0&&setMoodHeatmapYear(years[index-1].year)} aria-label="上一年">‹</button>
                      <strong>{selected.year}年</strong>
                      <button type="button" disabled={index>=years.length-1} onClick={()=>index<years.length-1&&setMoodHeatmapYear(years[index+1].year)} aria-label="下一年">›</button>
                    </div>}
                  </div>
                })()}
              </div>
            ) : (statsRange==='week'||statsRange==='month'||statsRange==='30d') && (
              <div className="mood-trend-wrap status-trend-wrap">
                <div className="status-trend-heading"><h4>状态变化</h4><div className="status-trend-legend"><span><i className="legend-mood-line" />心情</span><span><i className="legend-energy-line" />能量</span></div></div>
                {(statistics.moodLinePoints.length || statistics.energyLinePoints.length) ? <div className="mood-trend-layout status-trend-layout">
                  <div className="mood-chart-area">
                    <svg className="mood-trend-chart status-trend-chart" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="心情与能量状态变化对比">
                      {[4,12,20,28,36].map(y=><line key={y} x1="0" x2="100" y1={y} y2={y} className="mood-grid-line" />)}
                      {statistics.moodLinePoints.length>1 && <polyline points={statistics.moodLinePoints.map(p=>`${p.x},${p.y}`).join(' ')} className="status-mood-line" />}
                      {statistics.energyLinePoints.length>1 && <polyline points={statistics.energyLinePoints.map(p=>`${p.x},${p.y}`).join(' ')} className="status-energy-line" />}
                    </svg>
                    <div className="mood-x-axis">
                      <span className="mood-x-start">{statistics.rangeStart.slice(5).replace('-','/')}</span>
                      <span className="mood-x-end">{statistics.todayKey.slice(5).replace('-','/')}</span>
                    </div>
                  </div>
                </div> : <p className="page-empty compact">这个时间范围还没有心情或能量记录。</p>}
              </div>
            )}
          </section>

          <section className="stats-section">
            <div className="stats-section-title"><div><span className="eyebrow">TAGS</span><h3>标签分析</h3></div></div>
            <div className="tag-subsection">
              <div className="tag-subsection-heading"><h4>标签与任务的联系</h4><small>{statistics.tagTimelineAll?'完整生命周期 · 完成量与实际执行频率':'当前时间范围 · 完成量与实际执行频率'} · 未来任务不计</small></div>
              {statistics.tagTaskTimelines.length ? <div className="tag-task-timelines">
                <div className="tag-timeline-axis"><span>{statistics.timelineStart}</span><span>今天</span></div>
                {[...statistics.tagTaskTimelines].sort((a,b)=>b.completed-a.completed||(a.firstDate ?? '').localeCompare(b.firstDate ?? '')).map(row=>{
                  const firstDate = row.firstDate ?? statistics.timelineStart
                  const startPct=Math.max(0,dayDiff(statistics.timelineStart,firstDate)/statistics.timelineSpan*100)
                  const endPct=Math.min(100,dayDiff(statistics.timelineStart,row.endKey)/statistics.timelineSpan*100)
                  return <div className={`tag-timeline-row${row.tag.archived?' archived':''}`} key={row.tag.id}>
                    <div className="tag-timeline-meta"><strong>#{row.tag.name}</strong><span>完成 {row.completed}</span>{row.tag.archived&&<em>已归档</em>}</div>
                    <div className="tag-timeline-track" title={`${firstDate} → ${row.endKey}`}>
                      <i className="tag-lifecycle" style={{left:`${startPct}%`,width:`${Math.max(.4,endPct-startPct)}%`}} />
                      {statistics.tagTimelineAll&&<span className="tag-start-date" style={{left:`${startPct}%`}}>{firstDate}</span>}
                      {row.days.map(day=>{const x=dayDiff(statistics.timelineStart,day.date)/statistics.timelineSpan*100;return <b key={day.date} title={`${day.date} · ${day.count} 个任务`} style={{left:`${x}%`,background:row.tag.color,opacity:Math.min(1,.42+day.count*.18)}} />})}
                      {row.tag.archived&&<span className="tag-archive-end" style={{left:`${endPct}%`}} title={`归档于 ${row.endKey}`} />}
                    </div>
                  </div>
                })}
              </div> : <p className="page-empty compact">还没有带标签的历史任务。</p>}
            </div>
            <div className="tag-subsection">
              <div className="tag-subsection-heading"><h4>标签与心情的联系</h4><small>Event Impact · 具体 Journal 事件对你的影响</small></div>
              <p className="stats-note tag-matrix-note">颜色深浅表示该标签内部这一档所占比例。</p>
            <div className="tag-impact-matrix-wrap">
              <table className="tag-impact-matrix">
                <thead>
                  <tr>
                    <th>标签</th>
                    {([-2,-1,0,1,2] as JournalImpact[]).map(value=><th key={value} title={`Event Impact ${impactLabel(value)}`}><MoodFace level={(value+3) as MoodLevel} /></th>)}
                    <th>Journal</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.defaultTagImpactRow.journals>0 && <tr key={DEFAULT_TAG_ID}>
                    <th scope="row">#默认</th>
                    {statistics.defaultTagImpactRow.impacts.map(item=>{
                      const ratio=statistics.defaultTagImpactRow.journals ? item.count/statistics.defaultTagImpactRow.journals : 0
                      return <td key={item.value} title={`${impactLabel(item.value)} · ${item.count}篇 · ${statsPercent(ratio)}`}>
                        {item.count>0 ? <span className={`impact-cell impact-cell-${item.value<0?'negative':item.value>0?'positive':'neutral'}`} style={{'--impact-alpha':Math.max(.10,ratio*.78)} as any}>{item.count}</span> : <span className="impact-cell-zero">—</span>}
                      </td>
                    })}
                    <td className="tag-journal-total"><strong>{statistics.defaultTagImpactRow.journals}</strong><small>篇</small></td>
                  </tr>}
                  {[...statistics.tagRows].filter(row=>row.journals>0).sort((a,b)=>b.journals-a.journals||a.tag.name.localeCompare(b.tag.name)).map(row=><tr key={row.tag.id}>
                    <th scope="row">#{row.tag.name}</th>
                    {row.impacts.map(item=>{
                      const ratio=row.journals ? item.count/row.journals : 0
                      return <td key={item.value} title={`${impactLabel(item.value)} · ${item.count}篇 · ${statsPercent(ratio)}`}>
                        {item.count>0 ? <span className={`impact-cell impact-cell-${item.value<0?'negative':item.value>0?'positive':'neutral'}`} style={{'--impact-alpha':Math.max(.10,ratio*.78)} as any}>{item.count}</span> : <span className="impact-cell-zero">—</span>}
                      </td>
                    })}
                    <td className="tag-journal-total"><strong>{row.journals}</strong><small>篇</small></td>
                  </tr>)}
                  {statistics.journals.length>0&&<tr className="tag-impact-total-row">
                    <th scope="row">总计</th>
                    {statistics.impactCounts.map(item=><td key={item.value}>
                      {item.count>0?<span className={`impact-cell impact-cell-${item.value<0?'negative':item.value>0?'positive':'neutral'}`} style={{'--impact-alpha':Math.max(.10,(item.count/statistics.journals.length)*.78)} as any}>{item.count}</span>:<span className="impact-cell-zero">—</span>}
                    </td>)}
                    <td className="tag-journal-total"><strong>{statistics.journals.length}</strong><small>篇</small></td>
                  </tr>}
                </tbody>
              </table>
              {statistics.defaultTagImpactRow.journals===0 && statistics.tagRows.every(row=>row.journals===0) && <p className="page-empty compact">当前时间范围还没有带标签的 Journal。</p>}
            </div>
            </div>
          </section>
        </section>
      )}

      {mainView === 'anniversaries' && (
        <section className="anniversary-page">
          <div className="page-heading">
            <div><span className="eyebrow">ANNIVERSARIES</span><h2>纪念日</h2></div>
            <button className="page-add-button" type="button" onClick={() => openAnniversaryEditor()}>＋</button>
          </div>
          {anniversaryPageRows.length === 0 ? <p className="page-empty">还没有纪念日。</p> : (
            <div className="anniversary-page-list">
              {anniversaryPageRows.map(({anniversary, occurrence}) => (
                <button key={anniversary.id} className="anniversary-page-row" type="button" onClick={() => openAnniversaryEditor(anniversary)}>
                  <span className="anniversary-page-icon">{anniversaryIcon(anniversary.type)}</span>
                  <span className="anniversary-page-main"><strong>{anniversary.title}</strong><small>{anniversary.calendar==='lunar' ? `农历 ${anniversary.isLeapMonth?'闰':''}${anniversary.month}月${anniversary.day}日` : `${anniversary.month}月${anniversary.day}日`}</small></span>
                  <span className="anniversary-page-next">
                    {anniversary.repeatYearly && occurrence && anniversary.year && occurrence.getFullYear() >= anniversary.year && anniversary.type === 'birthday' && (
                      <strong>{occurrence.getFullYear() === anniversary.year ? '出生日' : `${occurrence.getFullYear() - anniversary.year}岁生日`}</strong>
                    )}
                    {anniversary.repeatYearly && occurrence && anniversary.year && occurrence.getFullYear() >= anniversary.year && anniversary.type === 'anniversary' && (
                      <strong>{occurrence.getFullYear() === anniversary.year ? '纪念日当天' : `${occurrence.getFullYear() - anniversary.year}周年`}</strong>
                    )}
                    <small>{anniversaryDistanceLabel(anniversary, occurrence, today)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {mainView === 'settings' && (
        <section className="settings-page">
          <div className="page-heading"><div><span className="eyebrow">SETTINGS</span><h2>设置</h2></div></div>

          <div className="settings-group personalization-settings">
            <div className="settings-group-title"><h3>个人化</h3></div>
            <label className="setting-row">
              <span><strong>顶部问候语</strong><small>显示在左上角品牌标记旁。</small></span>
              <input className="setting-text-input" value={greeting} onChange={e => setGreeting(e.target.value)} onBlur={() => { if (!greeting.trim()) setGreeting('Hello, Zing') }} />
            </label>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>日历</h3></div>
            <div className="setting-row"><span><strong>每周开始日</strong></span><div className="setting-segment"><button className={weekStartsMonday?'active':''} onClick={()=>setWeekStartsMonday(true)}>周一</button><button className={!weekStartsMonday?'active':''} onClick={()=>setWeekStartsMonday(false)}>周日</button></div></div>
            <div className="setting-row"><span><strong>日期格式</strong></span><div className="setting-segment"><button className={dateFormat==='dmy'?'active':''} onClick={()=>setDateFormat('dmy')}>22 Sep 2026</button><button className={dateFormat==='mdy'?'active':''} onClick={()=>setDateFormat('mdy')}>Sep 22, 2026</button></div></div>
            <div className="setting-row">
              <span><strong>重复任务显示</strong><small>“逐个显示”会保留已完成/已放弃的历史记录，未完成的重复序列只显示最早一个；完成或放弃后再显示下一个。</small></span>
              <div className="setting-segment"><button className={showAllRecurringTasks?'active':''} onClick={()=>setShowAllRecurringTasks(true)}>显示全部</button><button className={!showAllRecurringTasks?'active':''} onClick={()=>setShowAllRecurringTasks(false)}>逐个显示</button></div>
            </div>
            <div className="setting-row">
              <span><strong>新任务默认优先级</strong><small>只影响以后新建的任务，不修改已有任务。</small></span>
              <div className="default-priority-setting">{PRIORITIES.map(priority=><button key={priority.value} type="button" className={`default-priority-button priority-${priority.value}${defaultPriority===priority.value?' active':''}`} onClick={()=>setDefaultPriority(priority.value)}><i />{priority.label}</button>)}</div>
            </div>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>天气与体感</h3></div>
            <button className="settings-link-row" type="button" onClick={()=>setEnvironmentManagerKind('weather')}><span><strong>管理天气</strong><small>管理名称、Emoji、顺序与归档。</small></span><b>›</b></button>
            <button className="settings-link-row" type="button" onClick={()=>setEnvironmentManagerKind('thermal')}><span><strong>管理体感</strong><small>管理名称、Emoji、顺序与归档。</small></span><b>›</b></button>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>标签</h3></div>
            <button className="settings-link-row" type="button" onClick={()=>setTagManagerOpen(true)}><span><strong>标签管理</strong><small>管理任务、记录与专注共用的标签。</small></span><b>›</b></button>
            <button className="settings-link-row" type="button" onClick={()=>setArchivedTagsOpen(true)}><span><strong>已归档</strong><small>{archivedTags.length ? `${archivedTags.length} 个已归档标签` : '暂无已归档标签'}</small></span><b>›</b></button>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>专注</h3></div>
            <div className="encouragement-style-setting">
              <span><strong>最长专注时长</strong><small>达到上限后自动结束并保存，避免忘记停止计时。</small></span>
              <label className="max-focus-hours-control"><input type="number" min="2" max="12" step="1" value={maxFocusHours} onChange={event=>{const value=Number.parseInt(event.target.value,10);if(Number.isFinite(value))setMaxFocusHours(Math.min(12,Math.max(2,value)))}} /><b>小时</b></label>
            </div>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>鼓励语</h3></div>
            <div className="encouragement-style-setting">
              <span><strong>样式</strong><small>选择任务完成时鼓励卡的显示样式。</small></span>
              <div className="setting-segment"><button type="button" className={encouragementStyle==='dark'?'active':''} onClick={()=>setEncouragementStyle('dark')}>Dark</button><button type="button" className={encouragementStyle==='light'?'active':''} onClick={()=>setEncouragementStyle('light')}>Light</button><button type="button" className={encouragementStyle==='random'?'active':''} onClick={()=>setEncouragementStyle('random')}>随机</button></div>
            </div>
            <button className="settings-link-row" type="button" onClick={()=>setEncouragementManagerOpen(true)}>
              <span><strong>管理鼓励语</strong><small>{encouragementMessages.filter(item=>!item.deletedAt).length ? `已有 ${encouragementMessages.filter(item=>!item.deletedAt).length} 句话 · 完成任务时随机出现一句` : '写一些真正对自己有意义的话，完成任务时随机出现一句。'}</small></span><b>›</b>
            </button>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>词云</h3></div>
            <button className="settings-link-row" type="button" onClick={()=>setWordIgnoreManagerOpen(true)}>
              <span><strong>管理屏蔽词</strong><small>{wordCloudIgnored.length ? `已屏蔽 ${wordCloudIgnored.length} 个词` : '添加或恢复不参与词云统计的词。'}</small></span><b>›</b>
            </button>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>友情链接</h3></div>
            <button className="settings-link-row friend-link-row" type="button" onClick={()=>window.open('https://zzzing0-0.github.io/audio-vocabulary-sprint/index.html','_blank','noopener,noreferrer')}>
              <span><strong>Zing 背单词</strong><small>Audio Vocabulary Sprint · 背单词与学习统计</small></span><b>↗</b>
            </button>
            <button className="settings-link-row friend-link-row" type="button" onClick={()=>window.open('http://www.yunshangxiezuo.com/home','_blank','noopener,noreferrer')}>
              <span><strong>云上写作</strong><small>小说写作与作品数据</small></span><b>↗</b>
            </button>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>云同步</h3></div>
            <button className="settings-link-row" type="button" onClick={()=>setGithubSyncOpen(true)}>
              <span><strong>GitHub Sync</strong><small>{lastGithubSyncAt ? `上次同步 ${new Date(lastGithubSyncAt).toLocaleString()}` : 'GitHub 同步结构化数据；B2 同步图片与录音。'}</small></span><b>›</b>
            </button>
          </div>

          <div className="settings-group">
            <div className="settings-group-title"><h3>数据</h3></div>
            <div className="storage-card">
              <div className="storage-total"><span>当前有效数据</span><strong>{formatBytes(storageStats.data + effectiveAttachmentBytes)}</strong></div>
              <div className="storage-breakdown">
                <span><i>结构化数据（GitHub）</i><b>{formatBytes(storageStats.data)}</b></span>
                <button type="button" onClick={()=>setStorageBrowser('image')}><i>图片（{allStoredAttachments.filter(item=>item.type==='image').length} 个 · B2）</i><b>{formatBytes(effectiveImageBytes)}</b></button>
                <button type="button" onClick={()=>setStorageBrowser('audio')}><i>录音（{allStoredAttachments.filter(item=>item.type==='audio').length} 个 · B2）</i><b>{formatBytes(effectiveAudioBytes)}</b></button>
              </div>
              <small>本设备同时在 IndexedDB 保留数据与附件缓存，用于离线使用；这里显示的是当前有效内容，不代表 GitHub 仓库或 B2 桶的实际总占用。</small>
            </div>
            <div className="backup-settings-block">
              <button className="settings-link-row external-import-row" type="button" onClick={openExternalImport}>
                <span><strong>从外部导入</strong><small>通用 CSV 或已支持来源；导入任务统一标记为“从外部导入”。</small></span><b>›</b>
              </button>
              <button className="settings-link-row plain-export-row" type="button" onClick={()=>setPlainExportOpen(true)}>
                <span><strong>通用导出</strong><small>CSV 可直接用 Numbers、Excel 或其他软件打开，不用于 Zing 完整恢复。</small></span><b>›</b>
              </button>
              <button className="settings-link-row backup-export-row" type="button" onClick={()=>void exportFullBackup()} disabled={backupExporting}>
                <span><strong>备份</strong><small>任务、记录、心情、精力、经期、标签、纪念日、专注记录、设置与所有附件打包为 ZIP。</small></span>
                <b>{backupExporting?'…':'↓'}</b>
              </button>
              <button className="settings-link-row backup-import-row" type="button" onClick={()=>backupInputRef.current?.click()}>
                <span><strong>恢复数据</strong><small>从 Zing 完整备份 ZIP 恢复；确认后替换当前设备数据。</small></span><b>↑</b>
              </button>
              <input ref={backupInputRef} className="backup-file-input" type="file" accept=".zip,application/zip" onChange={event=>{ const file=event.target.files?.[0]; if(file) void inspectBackupFile(file) }} />
              <button className="settings-link-row orphan-cleanup-row" type="button" onClick={()=>void inspectB2Orphans()} disabled={orphanCleanupBusy}>
                <span><strong>清理 B2 孤儿附件</strong><small>先查看当前无任何任务或记录引用的 B2 文件，确认内容后再决定是否永久删除。</small></span><b>{orphanCleanupBusy?'…':'›'}</b>
              </button>
              <button className="settings-link-row danger-data-row" type="button" onClick={()=>setResetDataConfirm(true)}>
                <span><strong>清空所有数据</strong><small>清空任务、记录、心情、精力、经期、纪念日、专注记录、自建标签与附件；保留应用设置。删除会在下次 GitHub 同步传播。</small></span><b>×</b>
              </button>
              {backupMessage && <div className="backup-status" role="status">{backupMessage}</div>}
            </div>
          </div>
        </section>
      )}

      {githubSyncOpen && (
        <div className="modal-layer github-sync-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭 GitHub Sync" onClick={()=>setGithubSyncOpen(false)} />
          <section className="task-editor github-sync-modal" role="dialog" aria-modal="true" aria-label="GitHub Sync">
            <div className="editor-header">
              <div><span className="eyebrow">SYNC</span><h2>GitHub Sync</h2></div>
              <button className="close-button" type="button" onClick={()=>setGithubSyncOpen(false)}>×</button>
            </div>
            <div className="editor-body github-sync-body">
              <p className="github-sync-intro">Zing 仍以本地数据为主。同步时会先合并 Private Repository 中的数据，再写回云端。</p>
              <label><span>GitHub 用户名</span><input value={githubSyncOwner} onChange={e=>setGithubSyncOwner(e.target.value)} autoCapitalize="none" /></label>
              <label><span>数据仓库</span><input value={githubSyncRepo} onChange={e=>setGithubSyncRepo(e.target.value)} autoCapitalize="none" /></label>
              <label><span>分支</span><input value={githubSyncBranch} onChange={e=>setGithubSyncBranch(e.target.value)} autoCapitalize="none" /></label>
              <label><span>Fine-grained Token</span><input type="password" value={githubSyncToken} onChange={e=>{setGithubSyncToken(e.target.value);setGithubTokenSaved(false)}} autoComplete="off" placeholder="github_pat_…" /></label>
              <div className="github-sync-security">🔐 {githubTokenSaved?'此设备已保存 Token。它只保存在本设备 IndexedDB 的同步凭据区，不进入备份或 GitHub 数据仓库。':'同步成功后会将 Token 保存到本设备，下次打开无需重新输入。'}</div>
              {githubTokenSaved && <button className="github-sync-credential-remove" type="button" onClick={()=>void clearGitHubDeviceCredential().then(()=>{setGithubSyncToken('');setGithubTokenSaved(false);setGithubSyncMessage('已移除此设备保存的 Token');setGithubSyncMessageKind('idle')})}>移除此设备 Token</button>}
              {githubSyncMessage && <div className={`github-sync-status ${githubSyncMessageKind}`} role="status" aria-live="polite">{githubSyncMessage}</div>}
              <button className="github-sync-now" type="button" disabled={githubSyncBusy} onClick={()=>void runGithubSync()}>{githubSyncBusy?'正在同步…':'立即同步'}</button>
              {lastGithubSyncAt && <small className="github-sync-last">上次成功：{new Date(lastGithubSyncAt).toLocaleString()}</small>}
            </div>
          </section>
        </div>
      )}

      {githubSyncPreview && (
        <div className="modal-layer github-sync-summary-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="取消同步" onClick={()=>setGithubSyncPreview(null)} />
          <section className="task-editor github-sync-summary-modal" role="dialog" aria-modal="true" aria-label="确认同步">
            <div className="editor-header">
              <div><span className="eyebrow">SYNC PREVIEW</span><h2>确认同步</h2></div>
              <button className="close-button" type="button" onClick={()=>setGithubSyncPreview(null)}>×</button>
            </div>
            <div className="editor-body">
              <p className="sync-summary-time">{githubSyncPreview.initializedRemote?'服务器还没有同步数据；确认后将以本机数据初始化。':'以下只显示本次存在变化的数据。确认后才会合并并写回。'}</p>
              {(() => {
                const labels:any={task:'任务',journal:'日记',mood:'心情',energy:'能量',environment:'天气/体感',period:'月经',tag:'标签',anniversary:'纪念日',focus:'专注',settings:'设置',trash:'回收站'}
                const changedRows=githubSyncPreview.rows.filter(row=>row.added||row.updated||row.deleted||row.localCount!==row.remoteCount||row.localCount!==row.mergedCount||row.remoteCount!==row.mergedCount)
                return changedRows.length ? <>
                  <div className="sync-summary-grid">
                    {changedRows.map(row=><div className="sync-summary-row sync-preview-count-row" key={row.entityType}><b>{labels[row.entityType]||row.entityType}</b><span>本机 {row.localCount}</span><span>服务器 {row.remoteCount}</span><span>合并后 {row.mergedCount}</span></div>)}
                  </div>
                  <div className="sync-change-summary">
                    <b>本次变化</b>
                    {changedRows.map(row=>{
                      const changes=[row.added?`增加 ${row.added}`:'',row.updated?`更新 ${row.updated}`:'',row.deleted?`删除 ${row.deleted}`:''].filter(Boolean)
                      return changes.length?<div className="sync-change-row" key={row.entityType}><span>{labels[row.entityType]||row.entityType}</span><span>{changes.join('　')}</span></div>:null
                    })}
                  </div>
                </> : <div className="sync-summary-empty"><b>两端数据一致，无需合并</b></div>
              })()}
              <div className="editor-actions sync-preview-actions">
                <button type="button" className="secondary-button" onClick={()=>setGithubSyncPreview(null)}>取消</button>
                <button type="button" className="github-sync-now" onClick={()=>{setGithubSyncPreview(null);void executeGithubSync(false)}}>确认同步</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {environmentManagerKind && (()=> {
        const kind=environmentManagerKind
        const label=kind==='weather'?'天气':'体感'
        const rows=kind==='weather'?weatherOptions:thermalOptions
        return <div className="modal-layer environment-manager-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label={`关闭${label}管理`} onClick={()=>setEnvironmentManagerKind(null)} />
          <section className="task-editor environment-manager" role="dialog" aria-modal="true" aria-label={`管理${label}`}>
            <div className="editor-header"><div><span className="eyebrow">ENVIRONMENT</span><h2>管理{label}</h2></div><button className="close-button" type="button" onClick={()=>setEnvironmentManagerKind(null)}>×</button></div>
            <div className="editor-body environment-manager-body">
              <section className="environment-option-group">
                <div className="environment-option-heading"><div><strong>{label}</strong><small>每日单选 · 可不记录</small></div><button type="button" className="save-button compact" onClick={()=>addEnvironmentOption(kind)}>＋ 添加</button></div>
                <div className="environment-option-list">
                  {rows.filter(item=>!item.deletedAt).sort((a,b)=>a.order-b.order).map((item,index,shown)=><div className={`environment-option-row${item.archived?' archived':''}${item.builtin?' builtin':''}`} key={item.id}>
                    {item.builtin
                      ? <><span className="environment-option-emoji readonly">{item.emoji||'—'}</span><span className="environment-option-name readonly">{item.name}</span></>
                      : <>
                          <button type="button" className="environment-option-emoji editable" title="修改 Emoji" onClick={()=>editEnvironmentEmoji(kind,item)}>{item.emoji||'＋'}</button>
                          <button type="button" className="environment-option-name editable" title="修改名称" onClick={()=>renameEnvironmentOption(kind,item)}>{item.name}</button>
                          <div className="environment-option-actions compact">
                            <button type="button" disabled={index===0} onClick={()=>moveEnvironmentOption(kind,item,-1)} aria-label="上移">↑</button>
                            <button type="button" disabled={index===shown.length-1} onClick={()=>moveEnvironmentOption(kind,item,1)} aria-label="下移">↓</button>
                            <button type="button" onClick={()=>toggleArchiveEnvironmentOption(kind,item)}>{item.archived?'恢复':'归档'}</button>
                            {!environmentOptionUsed(kind,item.id)&&<button type="button" className="danger-text" onClick={()=>deleteEnvironmentOption(kind,item)}>删除</button>}
                          </div>
                        </>
                    }
                  </div>)}
                </div>
              </section>
            </div>
          </section>
        </div>
      })()}

      {encouragementManagerOpen && (
        <div className="modal-layer encouragement-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭鼓励语管理" onClick={()=>{setEncouragementManagerOpen(false);setEncouragementEditingId(null);setEncouragementDraft('')}} />
          <section className="task-editor encouragement-modal" role="dialog" aria-modal="true" aria-label="管理鼓励语">
            <div className="editor-header">
              <div><span className="eyebrow">ENCOURAGEMENT</span><h2>鼓励语</h2></div>
              <button className="close-button" type="button" onClick={()=>{setEncouragementManagerOpen(false);setEncouragementEditingId(null);setEncouragementDraft('')}}>×</button>
            </div>
            <div className="editor-body">
              <p className="encouragement-intro">只放你自己真正喜欢的话。完成任务时会随机出现一句；两句以上时不会连续重复。</p>
              <div className="encouragement-add">
                <textarea value={encouragementDraft} onChange={e=>setEncouragementDraft(e.target.value)} placeholder="写一句鼓励自己的话" rows={3} />
                <button type="button" disabled={!encouragementDraft.trim()} onClick={()=>{const text=encouragementDraft.trim();if(!text)return;const now=new Date().toISOString();if(encouragementEditingId){setEncouragementMessages(rows=>rows.map(item=>item.id===encouragementEditingId?{...item,text,updatedAt:now,deletedAt:undefined}:item))}else{setEncouragementMessages(rows=>[...rows,{id:crypto.randomUUID(),text,updatedAt:now}])}setEncouragementDraft('');setEncouragementEditingId(null)}}>{encouragementEditingId?'保存':'添加'}</button>
              </div>
              <div className="encouragement-list">
                {encouragementMessages.filter(item=>!item.deletedAt).length ? encouragementMessages.filter(item=>!item.deletedAt).map(item=><div className="encouragement-item" key={item.id}><p>{item.text}</p><div><button type="button" onClick={()=>{setEncouragementEditingId(item.id);setEncouragementDraft(item.text)}}>编辑</button><button type="button" className="danger-text" onClick={()=>{const now=new Date().toISOString();setEncouragementMessages(rows=>rows.map(row=>row.id===item.id?{...row,deletedAt:now,updatedAt:now}:row));if(encouragementEditingId===item.id){setEncouragementEditingId(null);setEncouragementDraft('')}}}>删除</button></div></div>) : <p className="page-empty compact">还没有鼓励语。</p>}
              </div>
            </div>
          </section>
        </div>
      )}

      {wordIgnoreManagerOpen && (
        <div className="modal-layer word-ignore-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭屏蔽词管理" onClick={()=>setWordIgnoreManagerOpen(false)} />
          <section className="task-editor word-ignore-modal" role="dialog" aria-modal="true" aria-label="管理屏蔽词">
            <div className="editor-header">
              <div><span className="eyebrow">WORD CLOUD</span><h2>管理屏蔽词</h2></div>
              <button className="close-button" type="button" onClick={()=>setWordIgnoreManagerOpen(false)}>×</button>
            </div>
            <div className="editor-body">
              <p className="word-ignore-intro">这些词不会进入 Journal 词云。词云中点击词语也可以直接加入这里。</p>
              <div className="word-ignore-add">
                <input value={wordIgnoreDraft} onChange={e=>setWordIgnoreDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();const word=wordIgnoreDraft.trim().toLowerCase();if(word){setWordCloudIgnored(list=>list.includes(word)?list:[...list,word]);setWordIgnoreDraft('')}}}} placeholder="添加屏蔽词" />
                <button type="button" onClick={()=>{const word=wordIgnoreDraft.trim().toLowerCase();if(word){setWordCloudIgnored(list=>list.includes(word)?list:[...list,word]);setWordIgnoreDraft('')}}}>添加</button>
              </div>
              <div className="word-ignore-panel-list">
                {wordCloudIgnored.length ? wordCloudIgnored.map(word=><button type="button" key={word} title="点击恢复到词云" onClick={()=>setWordCloudIgnored(list=>list.filter(item=>item!==word))}><span>{word}</span><b>×</b></button>) : <p className="page-empty compact">还没有手动屏蔽的词。</p>}
              </div>
            </div>
          </section>
        </div>
      )}

      {plainExportOpen && (
        <div className="modal-layer plain-export-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭通用导出" onClick={()=>setPlainExportOpen(false)} />
          <section className="task-editor plain-export-modal" role="dialog" aria-modal="true" aria-label="通用导出">
            <div className="editor-header">
              <div><span className="eyebrow">EXPORT</span><h2>通用导出</h2></div>
              <button className="close-button" type="button" onClick={()=>setPlainExportOpen(false)}>×</button>
            </div>
            <div className="editor-body">
              <p className="external-import-intro">选择要单独导出的重要数据。CSV 便于用 Numbers、Excel 等查看；完整保存与恢复仍请使用“备份”。</p>
              <div className="plain-export-actions plain-export-modal-actions">
                <button type="button" onClick={exportTasksCsv}><span>任务 CSV</span><b>↓</b></button>
                <button type="button" onClick={exportJournalsCsv}><span>记录 CSV</span><b>↓</b></button>
                <button type="button" onClick={exportFocusCsv}><span>专注 CSV</span><b>↓</b></button>
                <button type="button" onClick={exportAnniversariesCsv}><span>纪念日 CSV</span><b>↓</b></button>
              </div>
            </div>
          </section>
        </div>
      )}

      {externalImportOpen && (
        <div className="modal-layer external-import-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭外部导入" onClick={closeExternalImport} />
          <section className="task-editor external-import-modal" role="dialog" aria-modal="true" aria-label="从外部导入">
            <div className="editor-header">
              <div><span className="eyebrow">IMPORT</span><h2>从外部导入</h2></div>
              <button className="close-button" type="button" onClick={closeExternalImport} disabled={externalImportBusy}>×</button>
            </div>
            <div className="editor-body">
              {externalImportStage==='sources' && <>
                <p className="external-import-intro">外部数据会适配 Zing 的数据模型；Zing 没有的字段不会强行保存，需要时请回原 App 查看。</p>
                <button className="import-source-card" type="button" onClick={()=>{setExternalImportStage('generic-file');setExternalImportMessage('')}}>
                  <span className="import-source-icon">CSV</span><span><strong>通用导入 CSV</strong><small>自动识别常见任务字段；兼容滴答清单等 CSV 导出</small></span><b>›</b>
                </button>
                <button className="import-source-card" type="button" onClick={()=>{setExternalImportStage('dida-file');setExternalImportMessage('')}}>
                  <span className="import-source-icon">滴</span><span><strong>滴答清单</strong><small>导入历史任务</small></span><b>›</b>
                </button>
                <button className="import-source-card" type="button" onClick={()=>{setExternalImportStage('forest-file');setExternalImportMessage('')}}>
                  <span className="import-source-icon">F</span><span><strong>Forest</strong><small>导入历史专注时间与标签</small></span><b>›</b>
                </button>
                <div className="import-source-placeholder"><strong>其他来源</strong><small>以后可以继续添加 Todoist、Microsoft To Do 或其他格式，不需要改动这个入口。</small></div>
              </>}
              {externalImportStage==='generic-file' && <>
                <button className="import-back-link" type="button" onClick={()=>setExternalImportStage('sources')}>‹ 返回来源</button>
                <div className="import-file-panel">
                  <strong>通用 CSV</strong>
                  <p>自动识别标题、日期、完成状态、描述/备注、子任务、分类/标签、优先级和时间等常见中英文列名。无法映射的列会忽略。</p>
                  <button className="save-button" type="button" disabled={externalImportBusy} onClick={()=>externalImportInputRef.current?.click()}>{externalImportBusy?'正在解析…':'选择 CSV 文件'}</button>
                  <input ref={externalImportInputRef} className="backup-file-input" type="file" accept=".csv,text/csv" onChange={event=>{const file=event.target.files?.[0];if(file)void inspectGenericCsv(file)}} />
                </div>
              </>}
              {externalImportStage==='generic-preview' && didaImportPreview && <>
                <button className="import-back-link" type="button" onClick={()=>{setExternalImportStage('generic-file');setDidaImportPreview(null)}}>‹ 重新选择</button>
                <div className="import-preview-header"><strong>{didaImportPreview.fileName}</strong><small>字段识别完成，确认后才写入 Zing。</small></div>
                <div className="import-preview-grid">
                  <span>识别记录<b>{didaImportPreview.total}</b></span>
                  <span>将导入<b>{didaImportPreview.tasks.length}</b></span>
                  <span>重复跳过<b>{didaImportPreview.duplicateCount}</b></span>
                  <span>无日期跳过<b>{didaImportPreview.skippedNoDate}</b></span>
                </div>
                <div className="import-rule-note">
                  <strong>通用映射</strong>
                  <p>标题和日期为必需字段；完成状态、备注/描述、子任务、分类/标签、优先级和时间会在存在时自动迁入。无法识别的列直接忽略。历史完成任务若没有独立完成时间，则以任务日期作为完成日期。通用导入任务会带系统来源标签「从外部导入」和「通用」。</p>
                </div>
                <div className="backup-restore-actions">
                  <button type="button" onClick={closeExternalImport} disabled={externalImportBusy}>取消</button>
                  <button className="primary" type="button" onClick={()=>void importDidaCsv()} disabled={externalImportBusy||!didaImportPreview.tasks.length}>{externalImportBusy?'正在导入…':`导入 ${didaImportPreview.tasks.length} 条`}</button>
                </div>
              </>}
              {externalImportStage==='forest-file' && <>
                <button className="import-back-link" type="button" onClick={()=>setExternalImportStage('sources')}>‹ 返回来源</button>
                <div className="import-file-panel">
                  <strong>Forest CSV</strong>
                  <p>导入 Forest 历史专注。保留开始时间、结束时间和标签；「未设置」归入默认标签，不存在的标签会自动创建为共享标签。</p>
                  <button className="save-button" type="button" disabled={externalImportBusy} onClick={()=>externalImportInputRef.current?.click()}>{externalImportBusy?'正在解析…':'选择 Forest CSV'}</button>
                  <input ref={externalImportInputRef} className="backup-file-input" type="file" accept=".csv,text/csv" onChange={event=>{const file=event.target.files?.[0];if(file)void inspectForestCsv(file)}} />
                </div>
              </>}
              {externalImportStage==='forest-preview' && forestImportPreview && <>
                <button className="import-back-link" type="button" onClick={()=>{setExternalImportStage('forest-file');setForestImportPreview(null)}}>‹ 重新选择</button>
                <div className="import-preview-header"><strong>{forestImportPreview.fileName}</strong><small>解析完成，确认后才会写入 Zing 专注记录。</small></div>
                <div className="import-preview-grid">
                  <span>识别记录<b>{forestImportPreview.total}</b></span>
                  <span>将导入<b>{forestImportPreview.sessions.length}</b></span>
                  <span>重复跳过<b>{forestImportPreview.duplicateCount}</b></span>
                  <span>失败跳过<b>{forestImportPreview.failedCount}</b></span>
                  <span>无效时间<b>{forestImportPreview.invalidCount}</b></span>
                  <span>新建标签<b>{forestImportPreview.createdTagCount}</b></span>
                  <span>复用标签<b>{forestImportPreview.reusedTagCount}</b></span>
                </div>
                <div className="import-rule-note">
                  <strong>Forest 映射</strong>
                  <p>仅导入 Is Success=True 的记录；False 直接跳过。Start Time / End Time 转为实际专注时间，Forest Tag 保留；「未设置」使用默认标签。不存在的普通标签自动创建为共享标签。每条记录附加系统来源标签「从外部导入」和「Forest」。Tree Type 与 Note 不迁移。同一条 Forest 记录重复导入会自动跳过。</p>
                </div>
                <div className="backup-restore-actions">
                  <button type="button" onClick={closeExternalImport} disabled={externalImportBusy}>取消</button>
                  <button className="primary" type="button" onClick={()=>void importForestCsv()} disabled={externalImportBusy||!forestImportPreview.sessions.length}>{externalImportBusy?'正在导入…':`导入 ${forestImportPreview.sessions.length} 条`}</button>
                </div>
              </>}
              {externalImportStage==='dida-file' && <>
                <button className="import-back-link" type="button" onClick={()=>setExternalImportStage('sources')}>‹ 返回来源</button>
                <div className="import-file-panel">
                  <strong>滴答清单 CSV</strong>
                  <p>只导入 Zing 能表达的任务字段。滴答内部附件路径会被丢弃，不占用备注；导入记录会自动带系统来源标签「从外部导入」和「滴答清单」。</p>
                  <button className="save-button" type="button" disabled={externalImportBusy} onClick={()=>externalImportInputRef.current?.click()}>{externalImportBusy?'正在解析…':'选择 CSV 文件'}</button>
                  <input ref={externalImportInputRef} className="backup-file-input" type="file" accept=".csv,text/csv" onChange={event=>{const file=event.target.files?.[0];if(file)void inspectDidaCsv(file)}} />
                </div>
              </>}
              {externalImportStage==='dida-preview' && didaImportPreview && <>
                <button className="import-back-link" type="button" onClick={()=>{setExternalImportStage('dida-file');setDidaImportPreview(null)}}>‹ 重新选择</button>
                <div className="import-preview-header"><strong>{didaImportPreview.fileName}</strong><small>解析完成，确认后才会写入 Zing。</small></div>
                <div className="import-preview-grid">
                  <span>识别记录<b>{didaImportPreview.total}</b></span>
                  <span>将导入<b>{didaImportPreview.tasks.length}</b></span>
                  <span>重复跳过<b>{didaImportPreview.duplicateCount}</b></span>
                  <span>无日期跳过<b>{didaImportPreview.skippedNoDate}</b></span>
                  <span>附件路径丢弃<b>{didaImportPreview.strippedAttachmentCount}</b></span>
                  <span>清单型任务<b>{didaImportPreview.ignoredChecklistCount}</b></span>
                </div>
                <div className="import-rule-note">
                  <strong>本次规则</strong>
                  <p>标题、日期/时间、优先级、状态、完成时间、备注、重复规则与可识别标签会迁入；Zing 不支持的字段直接忽略。清单型任务保留文字内容，但不保留滴答的清单结构。系统来源标签由程序维护；滴答导入任务会标记「从外部导入」和「滴答清单」，普通任务不会出现这些来源标签。</p>
                </div>
                <div className="backup-restore-actions">
                  <button type="button" onClick={closeExternalImport} disabled={externalImportBusy}>取消</button>
                  <button className="primary" type="button" onClick={()=>void importDidaCsv()} disabled={externalImportBusy || didaImportPreview.tasks.length===0}>{externalImportBusy?'正在导入…':`导入 ${didaImportPreview.tasks.length} 条`}</button>
                </div>
              </>}
              {externalImportMessage && <div className="backup-status" role="status">{externalImportMessage}</div>}
            </div>
          </section>
        </div>
      )}

      {resetDataConfirm && (
        <div className="backup-restore-backdrop" role="presentation">
          <section className="backup-restore-modal reset-data-modal" role="dialog" aria-modal="true" aria-label="确认清空所有数据">
            <span className="eyebrow">RESET DATA</span><h2>清空所有数据？</h2>
            <p className="backup-restore-warning">任务、记录、Daily Mood、精力、经期、纪念日、专注记录、自建标签和附件都会被永久清空；应用设置与系统默认标签保留。删除会在下次 GitHub 同步传播到其他设备。此操作不可撤销，建议先导出完整备份。</p>
            <div className="backup-restore-actions">
              <button type="button" onClick={()=>setResetDataConfirm(false)} disabled={resettingData}>取消</button>
              <button className="danger-confirm" type="button" onClick={()=>void resetAllUserData()} disabled={resettingData}>{resettingData?'正在清空…':'确认清空'}</button>
            </div>
          </section>
        </div>
      )}

      {backupPreview && (
        <div className="backup-restore-backdrop" role="presentation">
          <section className="backup-restore-modal" role="dialog" aria-modal="true" aria-label="确认恢复备份">
            <h2>Zing Backup</h2>
            <p className="backup-restore-date">{new Date(backupPreview.manifest.exportedAt).toLocaleString()}</p>
            <div className="backup-summary-grid">
              <span>任务 <b>{backupPreview.tasks.length}</b></span><span>记录 <b>{backupPreview.journals.length}</b></span>
              <span>心情 <b>{backupPreview.moods.length}</b></span><span>精力 <b>{backupPreview.energies.length}</b></span><span>天气/体感 <b>{backupPreview.environments.length}</b></span>
              <span>经期 <b>{backupPreview.periods.length}</b></span><span>标签 <b>{backupPreview.tags.length}</b></span>
              <span>纪念日 <b>{backupPreview.anniversaries.length}</b></span><span>专注 <b>{backupPreview.focusSessions.length}</b></span>
              <span>附件 <b>{backupPreview.attachments.length}</b></span>
            </div>
            <p className="backup-restore-warning">恢复后将替换当前设备中的 Zing Calendar 数据。请确认当前数据已经另行备份。</p>
            <div className="backup-restore-actions">
              <button type="button" onClick={()=>setBackupPreview(null)} disabled={backupRestoring}>取消</button>
              <button className="primary" type="button" onClick={()=>void restoreBackup()} disabled={backupRestoring}>{backupRestoring?'正在恢复…':'恢复此备份'}</button>
            </div>
          </section>
        </div>
      )}

      {!editorOpen && !journalEditorOpen && !anniversaryEditorOpen && !tagManagerOpen && !archivedTagsOpen && !viewingJournalId && !viewingTask && !storageBrowser && !orphanCleanupOpen && !backupPreview && !resetDataConfirm && !externalImportOpen && !inboxOpen && !overdueInboxOpen && !trashOpen && !focusOpen && !focusHistoryDate && !monthPickerTarget && !dayDetailOpen && !imagePreview && !seriesAction && !confirmSingleTask && (
      <nav className="bottom-nav" aria-label="主要功能">
        <button type="button" className={mainView==='calendar'?'active':''} onClick={() => switchMainView('calendar')}><span>▦</span>日历</button>
        <button type="button" className={mainView==='anniversaries'?'active':''} onClick={() => switchMainView('anniversaries')}><span>🎂</span>纪念日</button>
        <button type="button" className={mainView==='statistics'?'active':''} onClick={() => switchMainView('statistics')}><span>⌁</span>统计</button>
        <button type="button" className={mainView==='settings'?'active':''} onClick={() => switchMainView('settings')}><span>⚙</span>设置</button>
      </nav>
      )}

      {orphanCleanupOpen && (
        <div className="modal-layer storage-browser-layer orphan-cleanup-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭孤儿附件检查" onClick={()=>setOrphanCleanupOpen(false)} />
          <section className="storage-browser orphan-cleanup-modal" role="dialog" aria-modal="true" aria-label="孤儿附件检查">
            <div className="storage-browser-header">
              <div><span className="eyebrow">B2 CLEANUP</span><h2>孤儿附件</h2><small>{orphanAttachments.length} 个文件 · 删除前可以逐个查看</small></div>
              <button className="close-button" type="button" onClick={()=>setOrphanCleanupOpen(false)}>×</button>
            </div>
            {orphanAttachments.length===0 ? <p className="page-empty">没有发现孤儿附件，B2 很干净。</p> : <>
              <p className="orphan-cleanup-note">这些文件当前没有任何任务、记录或回收站内容引用。图片可直接查看，录音可直接试听；无法识别的文件仍会显示 B2 storage key。</p>
              <div className="orphan-preview-list">{orphanAttachments.map(item=>{const image=item.contentType.startsWith('image/'),audio=item.contentType.startsWith('audio/');return <article className="orphan-preview-item" key={item.key}>
                <div className="orphan-preview-media">{image&&item.url?<img src={item.url} alt="孤儿附件"/>:audio&&item.url?<audio controls src={item.url}/>:<span>{item.url?'无法预览此文件':'预览链接获取失败'}</span>}</div>
                <div className="orphan-preview-meta"><code>{item.key}</code><small>{item.contentType||'未知类型'}{item.size?` · ${formatBytes(item.size)}`:''}</small></div>
              </article>})}</div>
              <div className="orphan-cleanup-actions"><button type="button" onClick={()=>setOrphanCleanupOpen(false)} disabled={orphanCleanupBusy}>暂不清理</button><button className="danger" type="button" onClick={()=>void cleanupB2Orphans()} disabled={orphanCleanupBusy}>{orphanCleanupBusy?'正在清理…':`永久删除 ${orphanAttachments.length} 个`}</button></div>
            </>}
          </section>
        </div>
      )}

      {storageBrowser && (
        <div className="modal-layer storage-browser-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭附件浏览" onClick={()=>setStorageBrowser(null)} />
          <section className="storage-browser">
            <div className="storage-browser-header">
              <div><span className="eyebrow">STORAGE</span><h2>{storageBrowser==='image'?'所有图片':'所有录音'}</h2><small>{browsedAttachments.length} 个附件 · {formatBytes(storageBrowser==='image'?storageStats.images:storageStats.audio)}</small></div>
              <button className="close-button" type="button" onClick={()=>setStorageBrowser(null)}>×</button>
            </div>
            {browsedAttachments.length===0 ? <p className="page-empty">还没有{storageBrowser==='image'?'图片':'录音'}。</p> : <>
              {storageBrowser==='image' ? <div className="storage-image-grid">{browsedActiveAttachments.map(attachment => <StorageImage key={attachment.storageKey} attachment={attachment} onPreview={openImagePreview} />)}</div>
                : <div className="storage-audio-list">{browsedActiveAttachments.map(attachment => <div className="storage-audio-row" key={attachment.storageKey}><span><strong>{attachment.filename}</strong><small>{formatBytes(attachment.size)}</small></span><AudioAttachment attachment={attachment}/></div>)}</div>}
              {browsedTrashedAttachments.length>0 && <section className="storage-trash-section"><div className="storage-trash-divider"><span>回收站 · {browsedTrashedAttachments.length}</span><small>所有引用它的内容都已进入回收站</small></div>
                {storageBrowser==='image' ? <div className="storage-image-grid">{browsedTrashedAttachments.map(attachment => <StorageImage key={attachment.storageKey} attachment={attachment} onPreview={openImagePreview} />)}</div>
                  : <div className="storage-audio-list">{browsedTrashedAttachments.map(attachment => <div className="storage-audio-row" key={attachment.storageKey}><span><strong>{attachment.filename}</strong><small>{formatBytes(attachment.size)}</small></span><AudioAttachment attachment={attachment}/></div>)}</div>}
              </section>}
            </>}

          </section>
        </div>
      )}

      {autoSyncToast && <div className="auto-sync-toast" role="status" aria-live="polite">{autoSyncToast}</div>}
      {encouragementReward && <div className={`encouragement-reward ${encouragementRewardStyle}`} role="status" aria-live="polite"><span>✓ 任务完成</span><strong>{encouragementReward}</strong></div>}

      <footer className="status-line">
        <span className="status-links" aria-label="基础设施快捷入口">
          <a href="https://github.com/zzZing0-0/zing-calendar" target="_blank" rel="noreferrer">GitHub</a><i aria-hidden="true">｜</i>
          <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Vercel</a><i aria-hidden="true">｜</i>
          <a href="https://secure.backblaze.com/b2_buckets.htm" target="_blank" rel="noreferrer">Backblaze B2</a>
        </span>
        <span className="status-version">Zing Calendar · v{APP_VERSION}</span>
      </footer>

      {selectedDate && dayDetailOpen && (
        <>
          <button className="drawer-backdrop" type="button" aria-label="关闭日期详情" onClick={closeDayDetail} />
          <aside className={`day-drawer${dayDetailClosing?' closing':''}`} aria-label={`${formatUiDate(selectedDate)} 日期详情`}>
            <div className="drawer-header">
              <div className="drawer-header-main">
                <div className="drawer-header-top">
                  <div>
                    <span className="eyebrow">DAY DETAIL</span>
                    <div className="drawer-date-line">
                      <h2>{formatUiDate(selectedDate)}</h2>
                      <button className="date-action-button" type="button" onClick={() => openAnniversaryEditor()} aria-label="添加纪念日" title="添加纪念日">＋</button>
                    </div>
                  </div>
                  <button className="close-button" type="button" onClick={closeDayDetail} aria-label="关闭">×</button>
                </div>
                <div className="drawer-date-meta-row">
                <span className="drawer-lunar-date">
                  农历 {lunarFullLabel(selectedDate)}
                  {(()=>{
                    const annotation=calendarAnnotation(selectedDate,weekStartsMonday)
                    return annotation && annotation.kind!=='week'
                      ? <><span className="drawer-date-separator"> · </span><span className={`drawer-calendar-annotation annotation-${annotation.kind}`}>{annotation.label}</span></>
                      : null
                  })()}
                </span>
                {!selectedIsFuture && <div className="journal-environment-strip drawer-environment-strip">
                  <button type="button" className={`journal-location-choice${selectedEnvironment?.locationCity?' selected':''}`} onClick={handleEnvironmentLocation}>
                    {selectedEnvironment?.locationCity ? `📍 ${selectedEnvironment.locationCity}` : '地点'}
                  </button>
                  <span className="journal-environment-separator" aria-hidden="true">｜</span>
                  <label className={`journal-environment-choice journal-environment-text-select${selectedEnvironment?.weatherOptionId?' selected':''}`}>
                    <span className="journal-environment-visible" aria-hidden="true">{selectedEnvironment?.weatherOptionId ? (()=>{const item=weatherOptions.find(row=>row.id===selectedEnvironment.weatherOptionId);return item?`${item.emoji?`${item.emoji} `:''}${item.name}`:'天气'})() : '天气'}</span>
                    <select aria-label="天气" value={selectedEnvironment?.weatherOptionId??''} onChange={event=>setEnvironmentChoice('weather',event.target.value)}>
                      <option value="">天气</option>
                      {weatherOptions.filter(item=>!item.deletedAt).sort((a,b)=>a.order-b.order).map(item=><option key={item.id} value={item.id} disabled={Boolean(item.archived)&&selectedEnvironment?.weatherOptionId!==item.id}>{item.emoji?`${item.emoji} `:''}{item.name}{item.archived?'（已归档）':''}</option>)}
                    </select>
                  </label>
                  <span className="journal-environment-separator" aria-hidden="true">｜</span>
                  <label className={`journal-environment-choice journal-environment-text-select${selectedEnvironment?.thermalOptionId?' selected':''}`}>
                    <span className="journal-environment-visible" aria-hidden="true">{selectedEnvironment?.thermalOptionId ? (()=>{const item=thermalOptions.find(row=>row.id===selectedEnvironment.thermalOptionId);return item?`${item.emoji?`${item.emoji} `:''}${item.name}`:'体感'})() : '体感'}</span>
                    <select aria-label="体感" value={selectedEnvironment?.thermalOptionId??''} onChange={event=>setEnvironmentChoice('thermal',event.target.value)}>
                      <option value="">体感</option>
                      {thermalOptions.filter(item=>!item.deletedAt).sort((a,b)=>a.order-b.order).map(item=><option key={item.id} value={item.id} disabled={Boolean(item.archived)&&selectedEnvironment?.thermalOptionId!==item.id}>{item.emoji?`${item.emoji} `:''}{item.name}{item.archived?'（已归档）':''}</option>)}
                    </select>
                  </label>
                </div>}
              </div>
              </div>
            </div>

            {selectedAnniversaries.length > 0 && (
              <section className="detail-section anniversary-section">
                <div className="section-heading"><h3>纪念日</h3><span>{selectedAnniversaries.length}</span></div>
                <div className="anniversary-list">{selectedAnniversaries.map(({anniversary, occurrence}) => (
                  <button key={anniversary.id} type="button" className="anniversary-row" onClick={() => openAnniversaryEditor(anniversary)}>
                    <span className="anniversary-row-icon">{anniversaryIcon(anniversary.type)}</span>
                    <span className="anniversary-row-title">{anniversary.title}</span>
                    <span className="anniversary-row-meta">{anniversaryMeta(anniversary, occurrence)}</span>
                  </button>
                ))}</div>
              </section>
            )}

            <section className="detail-section task-section">
              <div className="section-heading task-section-heading">
                <div className="task-heading-title"><h3>任务</h3>{selectedTasks.length > 0 && <span>{selectedTasks.length}</span>}</div>
                {endedTasksViewToggle('detail-ended-toggle')}
              </div>

              {selectedTasks.length === 0 ? (
                <p className="empty-state">这一天还没有任务。</p>
              ) : (
                <div className="task-list">
                  {selectedTasks.map(task => (
                    <article
                      key={task.id}
                      className={`task-item priority-${task.priority} status-${task.status} ${deadlineStage(task)}${isTaskOverdue(task) ? ' task-overdue' : ''}`}
                      onClick={() => openTaskDetail(task)}
                    >
                      <span className="task-priority-bar" />
                      <button
                        type="button"
                        className="task-checkbox"
                        aria-label={task.status === 'completed' ? `取消完成 ${task.title}` : task.status === 'abandoned' ? `恢复 ${task.title}` : `完成 ${task.title}`}
                        onClick={event => {
                          event.stopPropagation()
                          setTaskStatus(task, task.status === 'todo' ? 'completed' : 'todo')
                        }}
                      >
                        {task.status === 'completed' ? '✓' : task.status === 'abandoned' ? '×' : ''}
                      </button>
                      <strong className="task-title">{task.title}</strong>
                      {isMultiDayTask(task) && <span className="task-range">{formatTaskRange(task)}</span>}
                      {!task.allDay && task.time && <span className="task-card-time">{task.time}</span>}
                    </article>
                  ))}
                </div>
              )}

              <button className="add-button" type="button" onClick={openTaskEditor}>＋ 添加任务</button>
              {selectedDate && toDateKey(selectedDate) <= toDateKey(today) && <button className="day-focus-time day-focus-button" type="button" onClick={()=>setFocusHistoryDate(toDateKey(selectedDate))}>{sameDay(selectedDate,today) ? '今日专注' : '当日专注'} · {formatFocusDuration(selectedFocusSeconds)}<span>›</span></button>}
            </section>

            {!selectedIsFuture && <>
            <section className="detail-section mood-section">
              <div className="section-heading"><h3>今日心情</h3></div>
              <div className="mood-picker" aria-label="今日心情">
                {MOODS.slice().reverse().map(mood => (
                  <button key={mood.value} type="button" className={`mood-choice mood-${mood.value}${selectedMood?.level === mood.value ? ' active' : ''}`} onClick={() => setMood(mood.value)}>
                    <MoodFace level={mood.value} />
                    <span>{mood.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="detail-section energy-section">
              <div className="section-heading"><h3>身体能量</h3></div>
              <div className="energy-picker" aria-label="今日身体能量">
                {ENERGIES.slice().reverse().map(item => (
                  <button key={item.value} type="button" className={`energy-choice energy-${item.value}${selectedEnergy?.level===item.value?' active':''}`} onClick={()=>setEnergy(item.value)}>
                    <EnergyBattery level={item.value}/><span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>



            

                        </>}

            <section className="detail-section mood-calendar-section">
              <div className="mini-calendar-header">
                <div>
                  <span className="eyebrow">STATUS CALENDAR</span>
                  <div className="status-calendar-title"><h3>{statusCalendarMode==='mood'?'心情月历':'能量月历'}</h3><div className="status-mode-toggle"><button className={statusCalendarMode==='mood'?'active':''} onClick={()=>setStatusCalendarMode('mood')}>心情</button><button className={statusCalendarMode==='energy'?'active':''} onClick={()=>setStatusCalendarMode('energy')}>能量</button></div></div>
                </div>
                <div className="mini-month-navigation">
                  <button type="button" aria-label="上个月" onClick={() => setMoodMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
                  <strong>{MONTHS[moodMonth.getMonth()]} {moodMonth.getFullYear()}</strong>
                  <button type="button" aria-label="下个月" onClick={() => setMoodMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
                </div>
              </div>
              <div className="mini-weekdays">{displayWeekdays.map(day => <span key={day}>{day.slice(0, 1)}</span>)}</div>
              <div className="mood-mini-grid">
                {moodDays.map(({ date, inCurrentMonth }, index) => {
                  const key = toDateKey(date)
                  const mood = moodsByDate.get(key)
                  const energy = energyByDate.get(key)
                  const status = statusCalendarMode==='mood' ? mood : energy
                  const column = index % 7
                  const prevKey=index>0?toDateKey(moodDays[index-1].date):''
                  const nextKey=index<moodDays.length-1?toDateKey(moodDays[index+1].date):''
                  const prev = statusCalendarMode==='mood' ? moodsByDate.get(prevKey) : energyByDate.get(prevKey)
                  const next = statusCalendarMode==='mood' ? moodsByDate.get(nextKey) : energyByDate.get(nextKey)
                  const joinLeft = Boolean(status && column > 0 && prev?.level === status.level && moodDays[index - 1].inCurrentMonth)
                  const joinRight = Boolean(status && column < 6 && next?.level === status.level && moodDays[index + 1].inCurrentMonth)
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`mood-mini-day${inCurrentMonth ? '' : ' outside'}${sameDay(date, today) ? ' today' : ''}`}
                      disabled={key > toDateKey(today)}
                      onClick={() => {
                        if (key > toDateKey(today)) return
                        const nextDate = new Date(date)
                        const nextMonth = new Date(date.getFullYear(), date.getMonth(), 1)
                        cancelDayDetailCloseTimer()
                        setDayDetailClosing(false)
                        setSelectedDate(nextDate)
                        setDayDetailOpen(true)
                        setMoodMonth(nextMonth)
                        setVisibleMonth(nextMonth)
                      }}
                      aria-label={`${formatDate(date)}${status ? `，${statusCalendarMode==='mood' ? MOODS.find(item=>item.value===status.level)?.label : ENERGIES.find(item=>item.value===status.level)?.label}` : `，尚未记录${statusCalendarMode==='mood'?'心情':'能量'}`}`}
                    >
                      {status && inCurrentMonth && <span className={`mood-run mood-${status.level}${joinLeft ? ' join-left' : ''}${joinRight ? ' join-right' : ''}`} />}
                      <span className="mini-day-number">{date.getDate()}</span>
                      {inCurrentMonth && journalDates.has(key) && <span className="mini-journal-dot" aria-label="当天有记录" />}
                    </button>
                  )
                })}
              </div>
            </section>



            {!selectedIsFuture && <>
            <section className="detail-section journal-section">
              <div className="section-heading journal-heading">
                <h3>记录</h3>
                
              
                {selectedJournalEntries.length > 0 && <span>{selectedJournalEntries.length}</span>}
                {selectedJournalEntries.length > 0 && <strong className={`impact-total ${selectedImpactTotal > 0 ? 'positive' : selectedImpactTotal < 0 ? 'negative' : ''}`}>事件合计 {selectedImpactTotal > 0 ? '+' : ''}{selectedImpactTotal}</strong>}
              </div>
              {selectedJournalEntries.length === 0 ? <p className="empty-state">暂无记录</p> : (
                <div className="journal-list">
                  {selectedJournalEntries.map(entry => {
                    const entryTagIds = (entry.tagIds ?? [DEFAULT_TAG_ID]).filter(id => id !== DEFAULT_TAG_ID)
                    const visibleTags = entryTagIds.slice(0, 3)
                    const extraTags = Math.max(0, entryTagIds.length - visibleTags.length)
                    const images = (entry.attachments ?? []).filter(a => a.type === 'image').length
                    const hasAudio = (entry.attachments ?? []).some(a => a.type === 'audio')
                    return <button key={entry.id} type="button" className="journal-entry journal-card-v067" onClick={() => setViewingJournalId(entry.id)}>
                      <span className="journal-meta">{entry.time ?? '无时间'}</span>
                      <strong className="journal-title">{entry.title || '记录'}</strong>
                      <span className={`impact-badge impact-${entry.impact}`}>{entry.impact > 0 ? '+' : ''}{entry.impact}</span>
                      <span className="journal-card-bottom">
                        <span className="entry-tags">{visibleTags.map(id => { const tag = tags.find(item => item.id === id); return tag ? <span key={id} className="mini-tag" style={{ '--tag-color': tag.color } as any}>#{tag.name}</span> : null })}{extraTags > 0 && <span className="extra-tags">+{extraTags}</span>}</span>
                        <span className="journal-markers">{entry.content && <span title="有正文" aria-label="有正文">≡</span>}{images > 0 && <span title="有图片" aria-label="有图片">▧</span>}{hasAudio && <span title="有录音" aria-label="有录音">●</span>}</span>
                      </span>
                    </button>
                  })}
                </div>
              )}
              <button className="add-button" type="button" onClick={openJournalEditor}>＋ 添加记录</button>
            </section>

            <section className="detail-section menstrual-section">
              <div className="section-heading">
                <h3>{selectedIsFuture ? '预计经期' : '月经记录'}</h3>
                {menstrualPrediction && <small>预计下次约 {menstrualPrediction.start.slice(5).replace('-','/')} · ±1天</small>}
              </div>
              {selectedDate && (() => {
                const key=toDateKey(selectedDate)
                if (selectedIsFuture) {
                  if (!menstrualPrediction || key < menstrualPrediction.windowStart || key > menstrualPrediction.windowEnd) return null
                  return <div className="menstrual-prediction-card">预计日期，仅作任务安排参考；实际开始后再记录。</div>
                }
                const period=periodForDate(key)
                if(!period) return <button className="secondary-button" type="button" onClick={startPeriod}>＋ 月经开始</button>
                const log=period.dayLogs.find(row=>row.date===key)
                return <div className="menstrual-editor">
                  <div className="menstrual-summary"><strong>🩸 第 {dayDiff(period.startDate,key)+1} 天</strong><span>{period.startDate}{period.endDate?` → ${period.endDate}`:' · 进行中'}</span></div>
                  {!period.endDate && dayDiff(period.startDate,key)+1 > 7 && <div className="menstrual-duration-warning">本次记录已超过 7 天，请确认是否忘记标记结束；如果仍在持续，可以继续记录。</div>}
                  <label className="menstrual-note"><span>备注</span><input value={log?.notes??''} placeholder="可选，例如腹痛、量多、状态变化…" onChange={e=>updatePeriodDayLog(period.id,key,{notes:e.target.value})}/></label>
                  {!period.endDate && key>=period.startDate && <button className="secondary-button" type="button" onClick={()=>endPeriod(period.id,key)}>月经在今天结束</button>}
                  <button className="menstrual-delete-button" type="button" onClick={()=>deletePeriod(period.id)}>删除这次月经记录</button>
                </div>
              })()}
            </section>


            </>}

            {selectedIsFuture && selectedDate && menstrualPrediction && toDateKey(selectedDate)>=menstrualPrediction.windowStart && toDateKey(selectedDate)<=menstrualPrediction.windowEnd && (
              <section className="detail-section menstrual-section">
                <div className="section-heading"><h3>预计经期</h3><small>预计约 {menstrualPrediction.start.slice(5).replace('-','/')} · ±1天</small></div>
                <div className="menstrual-prediction-card">预计日期，仅作任务安排参考；实际开始后再记录。</div>
              </section>
            )}


                      </aside>
        </>
      )}

      {focusHistoryDate && (
        <div className="modal-layer focus-history-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭专注记录" onClick={()=>{setFocusHistoryDate(null);setFocusEditId(null)}} />
          <section className="task-editor focus-history-panel" role="dialog" aria-modal="true" aria-label="专注记录">
            <div className="editor-header"><div><span className="eyebrow">FOCUS LOG</span><h2>{focusHistoryDate} · 专注记录</h2></div><button className="close-button" type="button" onClick={()=>{setFocusHistoryDate(null);setFocusEditId(null)}}>×</button></div>
            <div className="editor-body focus-history-body">
              <div className="focus-history-summary"><strong>{formatFocusDuration(combinedFocusSecondsByDate(activeTasks,focusSessions,timerNow).get(focusHistoryDate)??0)}</strong><span>{focusHistoryRecords.length} 条记录</span></div>
              {focusHistoryRecords.length===0?<p className="page-empty compact">这一天还没有专注记录。</p>:<div className="focus-history-list">{focusHistoryRecords.map(record=>{
                const editing=record.kind==='direct'&&record.session&&focusEditId===record.session.id
                const focusTag=record.tagIds.filter(id=>!isImportSourceTagId(id)).map(id=>tags.find(tag=>tag.id===id)).find(Boolean)
                return <div className="focus-history-item" key={record.id}>
                  <div className="focus-history-main"><strong className="focus-history-primary">{focusTag&&<i style={{background:focusTag.color}} />}{focusTag?.name??'默认'}</strong><div className="focus-history-meta"><span>{record.kind==='task'?`任务 · ${record.title}`:'自由专注'}</span><small>{formatFocusDuration(record.seconds)}</small></div></div>
                  {editing&&record.session?<div className="focus-history-edit"><label>时长 <input type="number" min="1" max="1440" value={focusEditMinutes} onChange={e=>setFocusEditMinutes(e.target.value)} onBlur={()=>setFocusEditMinutes(String(boundedInteger(focusEditMinutes,1,FOCUS_EDIT_MAX_MINUTES,1)))} /> 分钟</label><div className="focus-history-edit-tags">{tagsFor(tags, 'task').map(tag=>{const checked=focusEditTagIds.includes(tag.id);return <button key={tag.id} type="button" className={checked?'selected':''} onClick={()=>setFocusEditTagIds([tag.id])}><i style={{background:tag.color}} />{tag.name}</button>})}</div><div className="focus-history-edit-actions"><button type="button" onClick={()=>setFocusEditId(null)}>取消</button><button type="button" className="primary" onClick={saveDirectFocusEdit}>保存</button></div></div>:<div className="focus-history-actions">
                    <button type="button" onClick={()=>{if(record.kind==='direct'&&record.session)beginEditDirectFocus(record.session);else if(record.task){setFocusHistoryDate(null);closeDayDetailImmediately();setViewingTask(record.task)}}}>更改</button>
                    <button type="button" className="danger" onClick={()=>{if(!window.confirm('确定删除这条专注记录吗？'))return;if(record.kind==='direct'&&record.session){const now=new Date().toISOString();setFocusSessions(cur=>cur.map(item=>item.id===record.session!.id?trashFocusSession(item,now):item));setAutoSyncToast('✓ 专注已移入回收站')}else if(record.task)clearTaskFocusRecord(record.task)}}>删除</button>
                  </div>}
                </div>})}</div>}
            </div>
          </section>
        </div>
      )}

      {focusOpen && (
        <div className="modal-layer focus-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label={activeFocusSession?'专注进行中':'关闭专注'} onClick={()=>{if(!activeFocusSession)setFocusOpen(false)}} />
          <section className="task-editor focus-panel" role="dialog" aria-modal="true" aria-label="专注">
            <div className="editor-header"><div><span className="eyebrow">FOCUS</span><h2>{activeFocusSession?'正在专注':'开始专注'}</h2></div>{!activeFocusSession&&<button className="close-button" type="button" onClick={()=>setFocusOpen(false)}>×</button>}</div>
            <div className="editor-body focus-body">
              {activeFocusSession ? <>
                <div className="focus-live-clock">{formatClock(activeFocusSession.mode==='countdown'?activeFocusRemaining:activeFocusElapsed)}</div>
                <div className="focus-live-tags">{activeFocusSession.tagIds.map(id=>tags.find(tag=>tag.id===id)).filter(Boolean).map(tag=><span key={tag!.id}><i style={{background:tag!.color}} />{tag!.name}</span>)}</div>
                <small>{activeFocusSession.mode==='countdown'?`倒计时 · 原定 ${Math.round((activeFocusSession.plannedSeconds??0)/60)} 分钟`:'正计时'}</small>
                <button className="focus-stop-button" type="button" onClick={()=>stopDirectFocus(false)}>■ 结束专注</button>
              </> : <>
                <div className="focus-mode-switch"><button type="button" className={focusMode==='stopwatch'?'active':''} onClick={()=>setFocusMode('stopwatch')}>正计时</button><button type="button" className={focusMode==='countdown'?'active':''} onClick={()=>setFocusMode('countdown')}>倒计时</button></div>
                {focusMode==='countdown' && <label className="focus-minutes-field"><span>时长</span><div><input type="number" min="1" max="720" value={focusMinutes} onChange={e=>setFocusMinutes(e.target.value)} onBlur={()=>setFocusMinutes(String(countdownMinutes(focusMinutes,15)))} /><b>分钟</b></div></label>}
                <div className="focus-tag-picker compact"><span>专注标签</span>{(()=>{const selected=tags.find(tag=>tag.id===(focusTagIds[0]??DEFAULT_TAG_ID))??DEFAULT_TAG;return <button className="focus-current-tag" type="button" onClick={()=>setFocusTagSelectOpen(true)}><span><i style={{background:selected.color}} />{selected.name}</span><b>›</b></button>})()}</div>

                {activeTimerTask && <p className="focus-conflict-note">当前有任务正在计时，请先结束任务计时。</p>}
                <button className="focus-start-button" type="button" disabled={Boolean(activeTimerTask)||focusTagIds.length===0} onClick={startDirectFocus}>▶ 开始专注</button>
              </>}
            </div>
          </section>
          {focusTagSelectOpen&&<div className="focus-tag-select-layer" role="presentation"><button className="modal-backdrop" type="button" aria-label="关闭标签选择" onClick={()=>setFocusTagSelectOpen(false)} /><section className="focus-tag-select-panel" role="dialog" aria-modal="true" aria-label="选择专注标签"><header><strong>选择专注标签</strong><button type="button" onClick={()=>setFocusTagSelectOpen(false)}>×</button></header><div className="focus-tag-select-list">{focusSelectableTags(tags).map(tag=><button key={tag.id} type="button" className={focusTagIds.includes(tag.id)?'selected':''} onClick={()=>{setFocusTagIds([tag.id]);setFocusTagSelectOpen(false)}}><i style={{background:tag.color}} /><span>{tag.name}</span>{focusTagIds.includes(tag.id)&&<b>✓</b>}</button>)}</div></section></div>}
        </div>
      )}

      {trashOpen && (
        <div className="modal-layer overdue-inbox-layer trash-inbox-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭回收站" onClick={()=>setTrashOpen(false)} />
          <section className="task-editor overdue-inbox-panel trash-inbox-panel" role="dialog" aria-modal="true" aria-labelledby="trash-inbox-title">
            <div className="editor-header">
              <div><span className="eyebrow">RECYCLE BIN</span><h2 id="trash-inbox-title">回收站 · {trashItems.length}</h2></div>
              <div className="trash-header-actions">{trashItems.length>0 && <button className="trash-clear-button" type="button" onClick={()=>{if(window.confirm(`确定永久删除回收站中的 ${trashItems.length} 项吗？此操作无法恢复。`)) clearTrash()}}>清空</button>}<button className="close-button" type="button" onClick={()=>setTrashOpen(false)} aria-label="关闭">×</button></div>
            </div>
            <div className="editor-body overdue-inbox-body">
              {trashItems.length===0 ? <p className="page-empty compact">回收站是空的。</p> : <>
                <div className="trash-filter-row" role="group" aria-label="回收站类型筛选">
                  {([['all','全部'],['task','任务'],['journal','记录'],['anniversary','纪念日'],['focus','专注']] as const).map(([value,label])=><button key={value} type="button" className={trashFilter===value?'active':''} onClick={()=>setTrashFilter(value)}>{label}</button>)}
                </div>
                {visibleTrashItems.length===0 ? <p className="page-empty compact">这一类还没有内容。</p> : <div className="overdue-inbox-list trash-inbox-list">
                  {(trashTaskGroups ? [
                    {label:'未完成',items:trashTaskGroups.active},
                    ...(showEndedTasks ? [{label:'已完成',items:trashTaskGroups.ended}] : []),
                  ] : [{label:'',items:visibleTrashItems}]).map(group=>group.items.length>0&&<div className="trash-task-group" key={group.label||'all'}>{group.label&&<div className="trash-task-group-label">{group.label} · {group.items.length}</div>}{group.items.map(item=><article key={item.key} className={`trash-inbox-item${item.entity==='task'&&trashTaskStatus(item)!=='todo'?' completed':''}`}>
                    <div className="trash-inbox-main"><strong>{item.entity==='task'&&trashTaskStatus(item)!=='todo'&&<span className="trash-task-status" aria-label="已完成">✓</span>}{item.entity==='task'?item.task.title:item.entity==='journal'?item.journal.title:item.entity==='anniversary'?item.anniversary.title:(tags.find(tag=>item.session.tagIds.includes(tag.id))?.name??'默认')}</strong><small>{item.entity==='journal'?`${item.journal.date.replaceAll('-','/')} · 记录`:item.entity==='anniversary'?`${anniversaryIcon(item.anniversary.type)} · 纪念日`:item.entity==='focus'?`${new Date(item.session.startedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · 自由专注 · ${formatFocusDuration(item.session.durationSeconds??0)}`:item.kind==='occurrence'?`${item.occurrenceDate?.replaceAll('-','/')} · 单次任务`:item.kind==='future'?`${item.occurrenceDate?.replaceAll('-','/')} 起 · 此后重复任务`:`${item.task.date ? item.task.date.replaceAll('-','/') : '收集箱'} · ${item.task.recurrence?'整个重复任务':'任务'}`}</small><time>删除于 {new Date(item.trashedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div>
                    <div className="trash-inbox-actions"><button type="button" onClick={()=>restoreTrashItem(item)}>恢复</button><button className="danger" type="button" onClick={()=>{if(window.confirm('永久删除后无法从回收站恢复，确定继续吗？')) permanentlyDeleteTrashItem(item)}}>永久删除</button></div>
                  </article>)}</div>)}
                </div>}
              </>}
            </div>
          </section>
        </div>
      )}

      {inboxOpen && (
        <div className="modal-layer overdue-inbox-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭收集箱" onClick={()=>setInboxOpen(false)} />
          <section className="task-editor overdue-inbox-panel" role="dialog" aria-modal="true" aria-labelledby="inbox-title">
            <div className="editor-header inbox-editor-header">
              <div><span className="eyebrow">INBOX</span><div className="inbox-title-row"><h2 id="inbox-title">收集箱 · {inboxTasks.length}</h2><button className="inbox-add-button" type="button" onClick={openInboxTaskEditor} aria-label="添加未排期任务" title="添加未排期任务">＋</button></div></div>
              <button className="close-button" type="button" onClick={()=>setInboxOpen(false)} aria-label="关闭">×</button>
            </div>
            <div className="editor-body overdue-inbox-body">
              <div className="inbox-sort-row" aria-label="收集箱排序优先级">
                {inboxSortOrder.map((key,index)=><Fragment key={key}><button className={`inbox-sort-chip${index===0?' primary':''}${inboxSortDropTarget===key&&inboxSortDragRef.current!==key?' drop-target':''}`} type="button" draggable
                  onDragStart={()=>{inboxSortDragRef.current=key;setInboxSortDropTarget(null)}} onDragEnter={()=>{if(inboxSortDragRef.current&&inboxSortDragRef.current!==key)setInboxSortDropTarget(key)}} onDragOver={event=>event.preventDefault()} onDragEnd={()=>{inboxSortDragRef.current=null;setInboxSortDropTarget(null)}} onDrop={()=>{const from=inboxSortDragRef.current;if(from)setInboxSortOrder(current=>moveInboxSortKey(current,from,key));inboxSortDragRef.current=null;setInboxSortDropTarget(null)}}
                  onTouchStart={()=>{inboxSortDragRef.current=key;setInboxSortDropTarget(null)}} onTouchMove={event=>{const touch=event.touches[0];const target=document.elementFromPoint(touch.clientX,touch.clientY)?.closest<HTMLButtonElement>('[data-inbox-sort-key]');const to=target?.dataset.inboxSortKey as InboxSortKey|undefined;if(to&&to!==inboxSortDragRef.current)setInboxSortDropTarget(to)}} onTouchEnd={event=>{const touch=event.changedTouches[0];const target=document.elementFromPoint(touch.clientX,touch.clientY)?.closest<HTMLButtonElement>('[data-inbox-sort-key]');const to=(target?.dataset.inboxSortKey as InboxSortKey|undefined)??inboxSortDropTarget??undefined;const from=inboxSortDragRef.current;if(from&&to)setInboxSortOrder(current=>moveInboxSortKey(current,from,to));inboxSortDragRef.current=null;setInboxSortDropTarget(null)}}
                  data-inbox-sort-key={key} aria-label={`${index===0?'首要排序：':'排序：'}${key==='time'?'时间':key==='priority'?'优先级':'标签'}`}>{inboxSortDropTarget===key&&inboxSortDragRef.current!==key&&<span className="inbox-sort-drop-cue">放这里</span>}{key==='time'?'时间':key==='priority'?'优先级':'标签'}</button>{index<inboxSortOrder.length-1&&<span className="inbox-sort-arrow" aria-hidden="true">›</span>}</Fragment>)}
              </div>
              {inboxTasks.length===0 ? <p className="page-empty compact">暂时没有未排期任务。</p> :
                <div className="overdue-inbox-list inbox-task-list">
                  {inboxTodoGroups.length>0&&<section className="inbox-task-group" aria-label="未完成任务">
                    <div className="inbox-task-group-label">未完成 · {inboxTodoGroups.reduce((sum,group)=>sum+group.tasks.length,0)}</div>
                    {inboxTodoGroups.map(group=><div className="inbox-primary-group" key={group.key}><div className="inbox-primary-group-label">{group.color&&<span className="inbox-group-dot" style={{background:group.color}} aria-hidden="true"/>}{group.label}</div><div className="inbox-task-group-items">{group.tasks.map(task=>{const meta=inboxTaskMeta(task);const tagIsPrimary=inboxSortOrder[0]==='tag';return <article key={task.id} className={`overdue-inbox-item priority-${task.priority}`}><div className="overdue-inbox-main"><button className="overdue-priority-box" type="button" aria-label={`完成 ${task.title}`} title="标记完成" onClick={()=>setTaskStatus(task,'completed')}>✓</button><button className="overdue-task-link" type="button" onClick={()=>openTaskDetail(task)}><strong>{task.title}</strong><time className="inbox-task-meta">{!tagIsPrimary&&<span className="inbox-task-tag"><i style={{background:meta.tagColor}} aria-hidden="true"/>{meta.tag}</span>}<span>{meta.activity}</span></time></button></div></article>})}</div></div>)}
                  </section>}
                  {showEndedTasks&&inboxCompletedTasks.length>0&&<section className="inbox-task-group completed" aria-label="已完成任务"><div className="inbox-task-group-label">已完成 · {inboxCompletedTasks.length}</div><div className="inbox-task-group-items">{inboxCompletedTasks.map(task=>{const meta=inboxTaskMeta(task);const tagIsPrimary=inboxSortOrder[0]==='tag';return <article key={task.id} className={`overdue-inbox-item priority-${task.priority} completed`}><div className="overdue-inbox-main"><span className="overdue-priority-box completed" aria-label="已完成">✓</span><button className="overdue-task-link" type="button" onClick={()=>openTaskDetail(task)}><strong>{task.title}</strong><time className="inbox-task-meta">{!tagIsPrimary&&<span className="inbox-task-tag"><i style={{background:meta.tagColor}} aria-hidden="true"/>{meta.tag}</span>}<span>{meta.activity}</span></time></button></div></article>})}</div></section>}
                </div>}
            </div>
          </section>
        </div>
      )}

      {overdueInboxOpen && (
        <div className="modal-layer overdue-inbox-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭已逾期收件箱" onClick={()=>setOverdueInboxOpen(false)} />
          <section className="task-editor overdue-inbox-panel" role="dialog" aria-modal="true" aria-labelledby="overdue-inbox-title">
            <div className="editor-header">
              <div><span className="eyebrow">OVERDUE INBOX</span><h2 id="overdue-inbox-title">已逾期 · {overdueTasks.length}</h2></div>
              <button className="close-button" type="button" onClick={()=>setOverdueInboxOpen(false)} aria-label="关闭">×</button>
            </div>
            <div className="editor-body overdue-inbox-body">
              {overdueTasks.length===0 ? <p className="page-empty compact">目前没有已逾期任务。</p> :
                <div className="overdue-inbox-list">
                  {overdueTasks.map(task=><article key={task.id} className={`overdue-inbox-item priority-${task.priority}`}>
                    <div className="overdue-inbox-main overdue-task-row">
                      <button className="overdue-priority-box" type="button" aria-label={`完成 ${task.title}`} title="标记完成" onClick={()=>setTaskStatus(task,'completed')}>✓</button>
                      <button className="overdue-task-link" type="button" onClick={()=>openTaskAtItsDay(task)}>
                        <strong>{task.title}</strong>
                        <time>{task.date?.replaceAll('-','/') ?? ''}</time>
                      </button>
                      <button className="overdue-postpone-today" type="button" onClick={()=>postponeTask(task,toDateKey(today))}>延期</button>
                    </div>
                  </article>)}
                </div>}
            </div>
          </section>
        </div>
      )}

      {monthPickerTarget && (
        <div className="modal-layer month-picker-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭年月选择" onClick={()=>setMonthPickerTarget(null)} />
          <section className="month-picker-panel" role="dialog" aria-modal="true" aria-label="选择年月">
            <div className="month-picker-year">
              <button type="button" onClick={()=>setMonthPickerYear(y=>y-1)} aria-label="上一年">‹</button>
              <strong>{monthPickerYear}</strong>
              <button type="button" onClick={()=>setMonthPickerYear(y=>y+1)} aria-label="下一年">›</button>
            </div>
            <div className="month-picker-grid">
              {MONTHS.map((name,index)=><button key={name} type="button" className={(monthPickerTarget==='calendar'?(isMobileCalendar?mobileActiveMonth:visibleMonth):moodMonth).getFullYear()===monthPickerYear && (monthPickerTarget==='calendar'?(isMobileCalendar?mobileActiveMonth:visibleMonth):moodMonth).getMonth()===index?'active':''} onClick={()=>chooseMonth(index)}>{name}</button>)}
            </div>
            <button className="month-picker-today" type="button" onClick={()=>{setMonthPickerYear(today.getFullYear());chooseMonth(today.getMonth())}}>今年本月</button>
          </section>
        </div>
      )}

      {anniversaryEditorOpen && (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭纪念日编辑" onClick={() => setAnniversaryEditorOpen(false)} />
          <section className="task-editor anniversary-editor" role="dialog" aria-modal="true" aria-labelledby="anniversary-editor-title">
            <div className="editor-header"><div><span className="eyebrow">ANNIVERSARY</span><h2 id="anniversary-editor-title">{editingAnniversaryId ? '编辑纪念日' : '新建纪念日'}</h2></div><button className="close-button" type="button" onClick={() => setAnniversaryEditorOpen(false)}>×</button></div>
            <div className="editor-body">
              <label className="field"><span>名称</span><input value={anniversaryDraft.title} onChange={e=>setAnniversaryDraft(d=>({...d,title:e.target.value}))} placeholder="例如：小A生日" autoFocus /></label>
              <div className="anniversary-type-grid">{ANNIVERSARY_TYPES.map(item=><button key={item.value} type="button" className={`anniversary-type-button${anniversaryDraft.type===item.value?' selected':''}`} onClick={()=>setAnniversaryDraft(d=>({...d,type:item.value,repeatYearly:item.value==='birthday'?true:d.repeatYearly,year:item.value!=='birthday'&&!d.year?String(today.getFullYear()):d.year}))}><span>{item.icon}</span>{item.label}</button>)}</div>
              <div className="segmented-control"><button type="button" className={anniversaryDraft.calendar==='solar'?'active':''} onClick={()=>setAnniversaryDraft(d=>({...d,calendar:'solar',isLeapMonth:false}))}>公历</button><button type="button" className={anniversaryDraft.calendar==='lunar'?'active':''} onClick={()=>setAnniversaryDraft(d=>({...d,calendar:'lunar'}))}>农历</button></div>
              <div className="anniversary-date-grid">
                <label className="field"><span>年份{anniversaryDraft.type==='birthday'?'（可选）':''}</span><select value={anniversaryDraft.year} onChange={e=>setAnniversaryDraft(d=>({...d,year:e.target.value}))}>{anniversaryDraft.type==='birthday'&&<option value="">——</option>}{Array.from({length:today.getFullYear()+20-1900+1},(_,i)=>today.getFullYear()+20-i).map(year=><option key={year} value={year}>{year}年</option>)}</select></label>
                <label className="field"><span>月</span><select value={anniversaryDraft.month} onChange={e=>setAnniversaryDraft(d=>({...d,month:Number(e.target.value)}))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}月</option>)}</select></label>
                <label className="field"><span>日</span><select value={anniversaryDraft.day} onChange={e=>setAnniversaryDraft(d=>({...d,day:Number(e.target.value)}))}>{Array.from({length:anniversaryDayLimit(anniversaryDraft.calendar,anniversaryDraft.month,anniversaryDraft.year?Number(anniversaryDraft.year):undefined)},(_,i)=><option key={i+1} value={i+1}>{i+1}日</option>)}</select></label>
              </div>
              {anniversaryDraft.calendar==='lunar' && <label className="anniversary-check"><input type="checkbox" checked={anniversaryDraft.isLeapMonth} onChange={e=>setAnniversaryDraft(d=>({...d,isLeapMonth:e.target.checked}))} /> 闰月</label>}
              {anniversaryDraft.type!=='birthday' && <label className="anniversary-check"><input type="checkbox" checked={anniversaryDraft.repeatYearly} onChange={e=>setAnniversaryDraft(d=>({...d,repeatYearly:e.target.checked}))} /> 每年重复</label>}
              <label className="field"><span>备注</span><textarea rows={3} value={anniversaryDraft.notes} onChange={e=>setAnniversaryDraft(d=>({...d,notes:e.target.value}))} placeholder="可选" /></label>
            </div>
            <div className="editor-actions">{editingAnniversaryId && <button className="danger-button" type="button" onClick={deleteAnniversary}>删除</button>}<button className="ghost-button" type="button" onClick={()=>setAnniversaryEditorOpen(false)}>取消</button><button className="save-button" type="button" onClick={saveAnniversary} disabled={!anniversaryDraft.title.trim() || (anniversaryDraft.type!=='birthday' && !anniversaryDraft.year)}>保存</button></div>
          </section>
        </div>
      )}

      {tagManagerOpen && (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭标签管理" onClick={() => {setSelectedTagManageId(null);setTagEditDraft(null);setTagManagerOpen(false)}} />
          <section className="task-editor tag-manager compact-tag-manager" role="dialog" aria-modal="true" aria-labelledby="tag-manager-title">
            <div className="editor-header"><div><span className="eyebrow">TAGS</span><h2 id="tag-manager-title">标签</h2></div><button className="close-button" type="button" onClick={() => {setSelectedTagManageId(null);setTagEditDraft(null);setTagManagerOpen(false)}}>×</button></div>
            <div className="editor-body">
              <div className="tag-scope-tabs" role="tablist" aria-label="标签分类">
                {([['both','共享'],['task','任务'],['journal','记录']] as const).map(([scope,label])=><button key={scope} type="button" className={newTagScope===scope?'active':''} onClick={()=>{setNewTagScope(scope);setSelectedTagManageId(null)}}>{label}<small>{activeManagedTags.filter(tag=>tag.scope===scope).length}</small></button>)}
              </div>

              <div className="compact-tag-create">
                <div className="compact-tag-create-main"><input value={newTagName} onChange={e=>setNewTagName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addTag()}} placeholder={`新建${tagScopeLabel(newTagScope)}`} /><button className="save-button" type="button" onClick={addTag} disabled={!newTagName.trim()}>添加</button></div>
                <div className="tag-color-row compact-palette">{TAG_COLORS.map(color=><button key={color} type="button" className={`tag-color${newTagColor===color?' active':''}`} style={{background:color}} onClick={()=>setNewTagColor(color)} aria-label={`选择颜色 ${color}`} />)}</div>
              </div>

              <div className="compact-tag-list">
                {activeManagedTags.filter(tag=>tag.scope===newTagScope).map(tag=><button key={tag.id} type="button" className="compact-tag-chip" onClick={()=>{setSelectedTagManageId(tag.id);setTagEditDraft({name:tag.name,color:tag.color,scope:tag.scope})}}>
                  <i style={{background:tag.color}} /><span>{tag.name}</span>
                </button>)}
                {activeManagedTags.every(tag=>tag.scope!==newTagScope)&&<p className="page-empty compact">这里还没有{tagScopeLabel(newTagScope)}。</p>}
              </div>

            </div>
          </section>
        </div>
      )}


      {selectedTagManageId && (() => {
        const tag=activeManagedTags.find(item=>item.id===selectedTagManageId)
        if(!tag) return null
        return <div className="modal-layer tag-edit-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭编辑标签" onClick={closeTagEditor} />
          <section className="task-editor compact-tag-edit-modal" role="dialog" aria-modal="true" aria-labelledby="tag-edit-title">
            <div className="editor-header">
              <div className="compact-tag-edit-title"><i style={{background:tag.color}} /><div><span className="eyebrow">TAG</span><h2 id="tag-edit-title">编辑标签</h2></div></div>
              <button className="close-button" type="button" aria-label="关闭编辑标签" onClick={closeTagEditor}>×</button>
            </div>
            <div className="editor-body compact-tag-edit-body">
              <label className="field"><span>名称</span><input value={tagEditDraft?.name ?? tag.name} onChange={e=>setTagEditDraft(current=>current?{...current,name:e.target.value}:current)} autoFocus /></label>
              <div className="field"><span>颜色</span><div className="tag-color-row detail-palette">{TAG_COLORS.map(color=><button key={color} type="button" className={`tag-color${(tagEditDraft?.color ?? tag.color)===color?' active':''}`} style={{background:color}} onClick={()=>setTagEditDraft(current=>current?{...current,color}:current)} aria-label={`设为 ${color}`} />)}</div></div>
              <div className="field"><span>分类</span><div className="tag-detail-scope">
                {([['both','共享'],['task','任务'],['journal','记录']] as const).map(([scope,label])=><button key={scope} type="button" className={(tagEditDraft?.scope ?? tag.scope)===scope?'active':''} onClick={()=>setTagEditDraft(current=>current?{...current,scope}:current)}>{label}</button>)}
              </div></div>
            </div>
            <div className="editor-actions compact-tag-edit-actions">
              <div className="compact-tag-edit-secondary">
                <button type="button" className="ghost-button" onClick={()=>{setTagArchived(tag.id,true);closeTagEditor()}}>归档</button>
                <button type="button" className="danger-button" onClick={()=>deleteTag(tag.id)}>删除</button>
              </div>
              <button type="button" className="save-button" onClick={()=>saveTagEdit(tag)} disabled={!tagEditDraft?.name.trim()}>保存</button>
            </div>
          </section>
        </div>
      })()}

      {archivedTagsOpen && (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭已归档标签" onClick={() => setArchivedTagsOpen(false)} />
          <section className="task-editor tag-manager compact-tag-manager" role="dialog" aria-modal="true" aria-labelledby="archived-tags-title">
            <div className="editor-header"><div><span className="eyebrow">ARCHIVED TAGS</span><h2 id="archived-tags-title">已归档</h2></div><button className="close-button" type="button" onClick={() => setArchivedTagsOpen(false)}>×</button></div>
            <div className="editor-body">
              {archivedTags.length ? <div className="archived-tag-list">{archivedTags.map(tag=>{
                const taskCount=tasks.filter(task=>(task.tagIds??[]).includes(tag.id)||Object.values(task.recurrenceExceptions??{}).some(exception=>(exception.tagIds??[]).includes(tag.id))).length
                const focusCount=focusSessions.filter(session=>(session.tagIds??[]).includes(tag.id)).length
                const journalCount=journalEntries.filter(entry=>(entry.tagIds??[]).includes(tag.id)).length
                return <div className="archived-tag-row" key={tag.id}>
                  <div className="archived-tag-info"><span><i style={{background:tag.color}} />{tag.name}</span><small>任务 {taskCount} · 专注 {focusCount} · 记录 {journalCount}</small></div>
                  <div className="archived-tag-actions"><button type="button" className="archive-button" onClick={()=>setTagArchived(tag.id,false)}>恢复</button><button type="button" className="delete-button compact-delete" onClick={()=>deleteTag(tag.id)}>删除</button></div>
                </div>
              })}</div> : <p className="page-empty compact">暂无已归档标签。</p>}
            </div>
          </section>
        </div>
      )}

      {viewingTask && (
        <div className="modal-layer task-view-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label={viewingTask.activeTimerStartedAt ? "任务计时中" : "关闭任务详情"} onClick={()=>{ if (!viewingTask.activeTimerStartedAt) setViewingTask(null) }} />
          <section className="task-editor task-viewer" role="dialog" aria-modal="true" aria-labelledby="task-view-title">
            <div className="editor-header task-view-header">
              <div className="task-view-heading">
                <div className="task-view-title-row">
                  <button
                    type="button"
                    className={`task-view-checkbox priority-${viewingTask.priority} status-${viewingTask.status}`}
                    aria-label={viewingTask.status==='completed'?'取消完成':'完成任务'}
                    onClick={()=>{
                      const nextStatus:TaskStatus=viewingTask.status==='completed'?'todo':'completed'
                      if (viewingTask.activeTimerStartedAt && nextStatus==='completed') {
                        stopTaskTimer(viewingTask, true)
                        return
                      }
                      setTaskStatus(viewingTask,nextStatus)
                      setViewingTask(current=>current?{...current,status:nextStatus,completedAt:nextStatus==='completed'?new Date().toISOString():undefined}:current)
                    }}
                  >{viewingTask.status==='completed'?'✓':viewingTask.status==='abandoned'?'×':''}</button>
                  <h2 id="task-view-title">{viewingTask.title}</h2>
                </div>
              </div>
              {!viewingTask.activeTimerStartedAt && <button className="close-button" type="button" onClick={()=>setViewingTask(null)} aria-label="关闭">×</button>}
            </div>
            <div className="editor-body task-view-body">
              {viewingTask.date && <div className="task-view-schedule" aria-label="任务时间">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.2 2"/></svg>
                <span>{isMultiDayTask(viewingTask) ? formatTaskRange(viewingTask) : `${formatUiDate(fromDateKey(viewingTask.date))}${!viewingTask.allDay && viewingTask.time ? ` · ${viewingTask.time}` : ''}`}</span>
              </div>}

              {viewingTask.status === 'todo' && (
                <section className={`task-timer-panel ${viewingTask.activeTimerStartedAt ? 'running' : ''}`}>
                  {viewingTask.activeTimerStartedAt ? (
                    <>
                      <span className="task-timer-label">正在专注</span>
                      <strong className="task-timer-clock">{formatRunningTimer(viewingTask)}</strong>
                      <button className="task-timer-stop" type="button" onClick={()=>stopTaskTimer(viewingTask)}>■ 结束计时</button>
                      <small>结束本次计时后，可继续浏览或编辑任务。</small>
                    </>
                  ) : (
                    <>
                      <span className="task-timer-label">任务计时</span>
                      <button className="task-timer-start" type="button" disabled={Boolean(activeFocusSession)} onClick={()=>startTaskTimer(viewingTask)}>▶ 开始计时</button>{activeFocusSession && <small>已有自由专注正在进行，请先结束后再开始任务计时。</small>}
                    </>
                  )}
                </section>
              )}

              {(viewingTask.attachments ?? []).some(item=>item.type==='image') && (
                <section className="task-view-section task-view-images">
                  <div className="attachment-list">
                    {(viewingTask.attachments ?? []).filter(item=>item.type==='image').map(attachment=>
                      <AttachmentThumb key={attachment.id} attachment={attachment} onPreview={attachment=>void openImagePreview(attachment)} />
                    )}
                  </div>
                </section>
              )}

              {Number(viewingTask.actualDurationMinutes ?? 0) > 0 && (
                <section className="task-view-section">
                  <h3>实际用时</h3><p>{formatActualDuration(viewingTask.actualDurationMinutes)}</p>
                </section>
              )}

              {viewingTask.deadline && <section className="task-view-section"><h3>截止日期</h3><p>{viewingTask.deadline}</p></section>}

              {(viewingTask.tagIds ?? []).filter(id=>id!==DEFAULT_TAG_ID).length>0 && (
                <section className="task-view-section">
                  <h3>标签</h3>
                  <div className="entry-tags task-view-tags">
                    {(viewingTask.tagIds ?? []).filter(id=>id!==DEFAULT_TAG_ID).map(id=>{
                      const tag=tags.find(item=>item.id===id)
                      return tag?<span key={id} className="mini-tag" style={{'--tag-color':tag.color} as any}>#{tag.name}</span>:null
                    })}
                  </div>
                </section>
              )}

              {viewingTask.notes && <section className="task-view-section"><h3>备注</h3><div className="task-view-notes">{viewingTask.notes}</div></section>}
            </div>
            <div className="editor-footer task-view-footer">
              {!viewingTask.activeTimerStartedAt && <button className="delete-button task-view-delete" type="button" onClick={()=>{
                      const task=viewingTask
                      const series=task.seriesId ? tasks.find(item=>item.id===task.seriesId) : task
                      if (!series) return
                      if (task.seriesId && task.occurrenceDate && series.recurrence) {
                        setEditingTaskId(series.id)
                        setEditingOccurrenceDate(task.occurrenceDate)
                        setViewingTask(null)
                        setSeriesAction('delete')
                        return
                      }
                      deleteTask(series,'series')
                      setViewingTask(null)
              }}>删除</button>}
              <div className="editor-primary-actions">
                {viewingTask.activeTimerStartedAt ? (
                  <span className="task-timer-lock-note">🔒 计时中，结束计时后可编辑或退出</span>
                ) : (<>
                  <button className="cancel-button" type="button" onClick={()=>setViewingTask(null)}>关闭</button>
                  <button className="save-button" type="button" onClick={()=>editTask(viewingTask)}>编辑</button>
                </>)}
              </div>
            </div>
          </section>
        </div>
      )}

      {viewingJournal && (
        <div className="modal-layer journal-view-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭记录详情" onClick={() => setViewingJournalId(null)} />
          <section className="task-editor journal-viewer" role="dialog" aria-modal="true" aria-labelledby="journal-view-title">
            <div className="editor-header">
              <div><span className="eyebrow">JOURNAL</span><h2 id="journal-view-title">{viewingJournal.title || '记录'}</h2></div>
              <button className="close-button" type="button" onClick={() => setViewingJournalId(null)} aria-label="关闭">×</button>
            </div>
            <div className="editor-body">
              <div className="journal-view-meta">
                <span>{viewingJournal.date}{viewingJournal.time ? ` · ${viewingJournal.time}` : ''}</span>
                <span className={`impact-badge impact-${viewingJournal.impact}`}>{viewingJournal.impact > 0 ? '+' : ''}{viewingJournal.impact}</span>
              </div>
              {viewingJournal.content && <div className="journal-view-content">{viewingJournal.content}</div>}
              {(viewingJournal.tagIds ?? []).filter(id=>id!==DEFAULT_TAG_ID && !isImportSourceTagId(id)).length>0 && <div className="entry-tags journal-view-tags">{(viewingJournal.tagIds ?? []).filter(id=>id!==DEFAULT_TAG_ID && !isImportSourceTagId(id)).map(id=>{const tag=tags.find(item=>item.id===id);return tag?<span key={id} className="mini-tag" style={{'--tag-color':tag.color} as any}>#{tag.name}</span>:null})}</div>}
              {(viewingJournal.attachments ?? []).some(a=>a.type==='image') && <div className="attachment-list">{(viewingJournal.attachments ?? []).filter(a=>a.type==='image').map(attachment=><AttachmentThumb key={attachment.id} attachment={attachment} onPreview={attachment=>void openImagePreview(attachment)} />)}</div>}
              {(viewingJournal.attachments ?? []).filter(a=>a.type==='audio').map(attachment=><AudioAttachment key={attachment.id} attachment={attachment}/>)}
            </div>
            <div className="editor-footer">
              <div className="editor-secondary-actions"><button type="button" className="delete-button" onClick={()=>deleteJournal(viewingJournal.id)}>删除记录</button></div>
              <div className="editor-primary-actions">
                <button className="cancel-button" type="button" onClick={()=>setViewingJournalId(null)}>关闭</button>
                <button className="save-button" type="button" onClick={()=>{const entry=viewingJournal;setViewingJournalId(null);editJournal(entry)}}>编辑</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {journalEditorOpen && (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭记录编辑器" onClick={closeJournalEditor} />
          <section className="task-editor journal-editor" role="dialog" aria-modal="true" aria-labelledby="journal-editor-title">
            <div className="editor-header">
              <div><span className="eyebrow">{editingJournalId ? 'EDIT JOURNAL' : 'NEW JOURNAL'}</span><h2 id="journal-editor-title">{editingJournalId ? '编辑记录' : '添加记录'}</h2></div>
              <button className="close-button" type="button" onClick={closeJournalEditor} aria-label="关闭">×</button>
            </div>
            <div className="editor-body">
              <label className="field full-field"><span>标题 *</span><input autoFocus value={journalDraft.title} onChange={event => setJournalDraft(current => ({ ...current, title: event.target.value }))} placeholder="给这条记录一个标题" /></label>
              <div className="field full-field"><span>事件影响</span><div className="impact-picker">{IMPACTS.map(impact => <button key={impact} type="button" className={`impact-choice impact-${impact}${journalDraft.impact === impact ? ' active' : ''}`} onClick={() => setJournalDraft(current => ({ ...current, impact }))}>{impact > 0 ? '+' : ''}{impact}</button>)}</div></div>
              <label className="field full-field"><span>正文 · Markdown</span><textarea rows={10} value={journalDraft.content} onChange={event => setJournalDraft(current => ({ ...current, content: event.target.value }))} placeholder="正文可选。支持标题、粗体、斜体、删除线、列表、引用、行内代码、分隔线和链接。" /></label>
              <div className="field full-field"><span>标签</span><div className="tag-picker">{tagsFor(tags, 'journal').map(tag => <button key={tag.id} type="button" className={`tag-choice${journalDraft.tagIds.includes(tag.id) ? ' active' : ''}`} style={{ '--tag-color': tag.color } as any} onClick={() => toggleDraftTag('journal', tag.id)}><i />{tag.name}</button>)}</div></div>
              <div className="field full-field journal-image-field"><span>图片 · 最多 9 张</span><div className="attachment-source-actions"><label className="attachment-add">＋ 从设备添加<input className="journal-file-input" type="file" accept="image/*" multiple onChange={event => { void addJournalImages(event.target.files); event.currentTarget.value = '' }} disabled={journalDraft.attachments.filter(a => a.type === 'image').length >= 9} /></label><button type="button" className="attachment-add" onClick={()=>setImageLibraryTarget('journal')} disabled={journalDraft.attachments.filter(a=>a.type==='image').length>=9}>▧ 从图片库选择</button></div>
                {journalDraft.attachments.some(a => a.type === 'image') && <div className="attachment-list">{journalDraft.attachments.filter(a => a.type === 'image').map(attachment => <AttachmentThumb key={attachment.id} attachment={attachment} onRemove={() => void removeJournalAttachment(attachment)} onPreview={attachment => void openImagePreview(attachment)} />)}</div>}
                <small>自动压缩后保存 · 单张约 1 MB · 最多 9 张</small>
              </div>
              <div className="field full-field"><span>录音 · 最多 1 条 / 30 分钟</span>
                {journalDraft.attachments.find(a => a.type === 'audio') ? (() => { const audio = journalDraft.attachments.find(a => a.type === 'audio')!; return <div className="journal-audio-edit"><AudioAttachment attachment={audio}/><button type="button" onClick={() => void removeJournalAttachment(audio)}>删除录音</button></div> })() :
                  <button type="button" className="record-button" onClick={recording ? stopJournalRecording : () => void startJournalRecording()}>{recording ? `■ 停止录音 ${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2,'0')}` : '● 开始录音'}</button>}
              </div>
              <div className="field-grid journal-date-row">
                <label className="field"><span>日期</span><input type="date" value={journalDraft.date} onChange={event => setJournalDraft(current => ({ ...current, date: event.target.value }))} /></label>
                <label className="field"><span>时间</span><input type="time" value={journalDraft.time} onChange={event => setJournalDraft(current => ({ ...current, hasTime: true, time: event.target.value }))} /></label>
              </div>
            </div>
            <div className="editor-footer">
              {editingJournalId && <div className="editor-secondary-actions"><button type="button" className="delete-button" onClick={() => { deleteJournal(editingJournalId); closeJournalEditor() }}>删除记录</button></div>}
              <div className="editor-primary-actions"><button className="cancel-button" type="button" onClick={closeJournalEditor}>取消</button><button className="save-button" type="button" onClick={saveJournal} disabled={!journalDraft.title.trim()}>{editingJournalId ? '保存修改' : '保存记录'}</button></div>
            </div>
          </section>
        </div>
      )}

      {editorOpen && (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭任务编辑器" onClick={closeEditor} />
          <section className="task-editor" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
            <div className="editor-header">
              <div>
                <span className="eyebrow">{editingTaskId ? 'TASK DETAIL' : 'NEW TASK'}</span>
                <h2 id="task-editor-title">{editingTaskId ? '任务详情' : '添加任务'}</h2>
              </div>
              <button className="close-button" type="button" onClick={closeEditor} aria-label="关闭">×</button>
            </div>

            <div className="editor-body">
              <label className="field full-field task-title-field">
                <span>任务名称 *</span>
                <div className="task-title-input-wrap">
                  <input autoFocus value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="要做什么？" />
                  {editingTaskId && (() => {
                    const series = tasks.find(task => task.id === editingTaskId)
                    const shown = series ? (editingOccurrenceDate ? materializeOccurrence(series, editingOccurrenceDate) : series) : null
                    const count = shown?.postponeHistory?.length ?? 0
                    return count > 0 ? <small className={`postpone-count${count > 3 ? ' postpone-count-high' : ''}`}>↪ 已延期 {count} 次</small> : null
                  })()}
                </div>
              </label>

              <div className="field full-field">
                <span>优先级</span>
                <div className="priority-picker">
                  {PRIORITIES.map(priority => (
                    <button key={priority.value} type="button" className={`priority-choice priority-${priority.value}${draft.priority === priority.value ? ' active' : ''}`} onClick={() => setDraft(current => ({ ...current, priority: priority.value }))}>
                      <span className="priority-dot" />
                      <strong>{priority.label}</strong>
                      <small>{priority.hint}</small>
                    </button>
                  ))}
                </div>
              </div>


              <div className="field full-field attachment-field">
                <span>图片附件</span>
                <div className="attachment-source-actions"><label className="attachment-add">＋ 从设备添加<input type="file" accept="image/*" multiple onChange={event => { void addTaskImages(event.target.files); event.currentTarget.value = '' }} /></label><button type="button" className="attachment-add" onClick={()=>setImageLibraryTarget('task')}>▧ 从图片库选择</button></div>
                {draft.attachments.length > 0 && <div className="attachment-grid">{draft.attachments.map(attachment => <AttachmentThumb key={attachment.id} attachment={attachment} onRemove={() => void removeTaskImage(attachment)} onPreview={attachment => void openImagePreview(attachment)} />)}</div>}
                <small>自动压缩后保存 · 单张上限 1 MB</small>
              </div>

              <div className="field full-field task-notes-field">
                <div className="task-notes-heading"><span>备注</span><div className="task-notes-tools"><button type="button" onClick={insertTaskNoteChecklist} title="插入清单项">☐ 清单</button><button type="button" onClick={toggleTaskNoteChecklistLine} title="勾选或取消当前清单项">✓ 切换</button></div></div>
                <textarea ref={taskNotesRef} rows={4} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} onKeyDown={handleTaskNotesKeyDown} placeholder="可选" />
              </div>

              <div className="field full-field"><span>标签</span><div className="tag-picker">{tagsFor(tags, 'task').map(tag => <button key={tag.id} type="button" className={`tag-choice${draft.tagIds.includes(tag.id) ? ' active' : ''}`} style={{ '--tag-color': tag.color } as any} onClick={() => toggleDraftTag('task', tag.id)}><i />{tag.name}</button>)}</div>
                {draft.tagIds.some(isImportSourceTagId) && <div className="task-source-readonly">{draft.tagIds.filter(isImportSourceTagId).map(id => { const tag=tags.find(item=>item.id===id); return tag ? <span key={id} className="task-source-tag">#{tag.name}</span> : null })}<small>来源标签由系统管理</small></div>}
              </div>

              <div className="time-row task-timing-toggle">
                <label className="check-field">
                  <input type="checkbox" checked={Boolean(draft.date)} onChange={event => {
                    if (!event.target.checked) {
                      if (draft.repeatPreset !== 'none') { window.alert('请先取消重复。重复任务需要关联日期。'); return }
                      setDraft(current => ({ ...current, date: '', endDate: '', allDay: false, time: '' }))
                    } else setDraft(current => ({ ...current, date: toDateKey(selectedDate ?? today) }))
                  }} />
                  <span>安排日期</span>
                </label>
                {draft.date && <label className="check-field">
                  <input type="checkbox" checked={draft.allDay} onChange={event => setDraft(current => ({ ...current, allDay: event.target.checked, endDate: event.target.checked ? current.endDate : '' }))} />
                  <span>跨日期</span>
                </label>}
              </div>

              {!draft.date ? null : draft.allDay ? (
                <div className="field-grid">
                  <label className="field"><span>开始日期</span><input type="date" value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value, endDate: current.endDate && current.endDate < event.target.value ? '' : current.endDate }))} /></label>
                  <label className="field"><span>结束日期 · 可选</span><input type="date" min={draft.date} value={draft.endDate} onChange={event => setDraft(current => ({ ...current, endDate: event.target.value }))} /></label>
                </div>
              ) : (
                <div className="field-grid">
                  <label className="field"><span>日期</span><input type="date" value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value, endDate: '' }))} /></label>
                  <label className="field"><span>时间</span><input type="time" value={draft.time} onChange={event => setDraft(current => ({ ...current, time: event.target.value }))} /></label>
                </div>
              )}
              {editingTaskId && (() => {
                const series = tasks.find(task => task.id === editingTaskId)
                const shown = series ? (editingOccurrenceDate ? materializeOccurrence(series, editingOccurrenceDate) : series) : null
                if (!shown) return null
                return <div className="task-history-strip">
                  {shown.completedAt && <span>✓ 完成于 {new Date(shown.completedAt).toLocaleString()}</span>}
                </div>
              })()}

              <div className="field-grid deadline-postpone-row">
                <label className="field">
                  <span>Deadline</span>
                  <input type="date" value={draft.deadline} onChange={event => setDraft(current => ({ ...current, deadline: event.target.value }))} />
                </label>
                {editingTaskId && (() => {
                  const series = tasks.find(task => task.id === editingTaskId)
                  const shown = series ? (editingOccurrenceDate ? materializeOccurrence(series, editingOccurrenceDate) : series) : null
                  return shown && shown.date && shown.status === 'todo' && taskEndDate(shown) < toDateKey(new Date()) ? (
                    <label className="field postpone-field"><span>延期到</span><div className="postpone-inline"><input type="date" min={toDateKey(new Date())} defaultValue={toDateKey(new Date())} id="postpone-date" /><button type="button" onClick={() => { const input = document.getElementById('postpone-date') as HTMLInputElement | null; if (input?.value && input.value > taskEndDate(shown)) { postponeTask(shown, input.value); closeEditor() } }}>延期</button></div></label>
                  ) : null
                })()}
              </div>

              {draft.date && <div className="field-grid repeat-fields">
                <label className="field">
                  <span>重复</span>
                  <select value={draft.repeatPreset} onChange={event => setDraft(current => ({ ...current, repeatPreset: event.target.value as TaskDraft['repeatPreset'] }))}>
                    <option value="none">不重复</option><option value="daily">每天</option><option value="weekly">{repeatPresetLabels(draft.date).weekly}</option><option value="monthly">{repeatPresetLabels(draft.date).monthly}</option><option value="yearly">{repeatPresetLabels(draft.date).yearly}</option><option value="custom">自定义</option>
                  </select>
                </label>
                {draft.repeatPreset === 'custom' && <label className="field"><span>每隔</span><div className="repeat-interval"><input type="number" min="1" max="999" value={draft.repeatInterval} onChange={event => setDraft(current => ({ ...current, repeatInterval: Math.min(999, Math.max(1, Number(event.target.value) || 1)) }))} /><select value={draft.repeatUnit} onChange={event => setDraft(current => ({ ...current, repeatUnit: event.target.value as RecurrenceUnit }))}><option value="day">天</option><option value="week">周</option><option value="month">月</option></select></div></label>}
              </div>}
              {draft.date && draft.repeatPreset === 'custom' && draft.repeatUnit === 'week' && <div className="field full-field"><span>重复星期</span><div className="weekday-picker">{WEEKDAYS.map((day, index) => <button key={day} type="button" className={draft.repeatWeekdays.includes(index) ? 'active' : ''} onClick={() => setDraft(current => ({ ...current, repeatWeekdays: current.repeatWeekdays.includes(index) ? current.repeatWeekdays.filter(value => value !== index) : [...current.repeatWeekdays, index] }))}>{day}</button>)}</div></div>}
              {draft.date && draft.repeatPreset !== 'none' && <div className="field-grid repeat-end-fields">
                <label className="field"><span>结束</span><select value={draft.repeatEndMode} onChange={event => setDraft(current => ({ ...current, repeatEndMode: event.target.value as TaskDraft['repeatEndMode'] }))}><option value="never">永不</option><option value="date">按日期</option><option value="count">按次数</option></select></label>
                {draft.repeatEndMode === 'date' && <label className="field"><span>结束日期</span><input type="date" min={draft.date} value={draft.repeatEndDate} onChange={event => setDraft(current => ({ ...current, repeatEndDate: event.target.value }))} /></label>}
                {draft.repeatEndMode === 'count' && <label className="field"><span>重复次数</span><div className="repeat-count"><input type="number" min="1" max="9999" value={draft.repeatEndCount} onChange={event => setDraft(current => ({ ...current, repeatEndCount: Math.min(9999, Math.max(1, Number(event.target.value) || 1)) }))} /><span>次</span></div></label>}
              </div>}
              {editingTaskId && (() => {
                const series = tasks.find(task => task.id === editingTaskId)
                const shown = series ? (editingOccurrenceDate ? materializeOccurrence(series, editingOccurrenceDate) : series) : null
                if (!shown || shown.status !== 'completed') return null
                return <div className="field full-field actual-duration-field">
                  <span>实际用时 · 可选</span>
                  <div className="actual-duration-inputs">
                    <label><input type="number" min="0" inputMode="numeric" value={draft.actualDurationHours} onChange={event=>setDraft(current=>({...current,actualDurationHours:event.target.value}))} placeholder="0" /><small>小时</small></label>
                    <label><input type="number" min="0" max="59" inputMode="numeric" value={draft.actualDurationMinutes} onChange={event=>setDraft(current=>({...current,actualDurationMinutes:event.target.value}))} onBlur={()=>setDraft(current=>({...current,actualDurationMinutes:String(Math.min(59,Math.max(0,Number.parseInt(current.actualDurationMinutes||'0',10)||0)))}))} placeholder="0" /><small>分钟</small></label>
                  </div>
                  <small>不计时、不强制填写，只记录你对这个任务实际耗时的大致估计。</small>
                </div>
              })()}
            </div>

            <div className="editor-footer">
              {editingTaskId && (
                <div className="editor-secondary-actions">
                  {editingOccurrenceDate && tasks.find(task => task.id === editingTaskId)?.recurrence && (
                    <button type="button" className="abandon-button" onClick={() => {
                      const series = tasks.find(task => task.id === editingTaskId)
                      if (series) stopRepeating(series, editingOccurrenceDate)
                    }}>停止重复</button>
                  )}
                  <button type="button" className="abandon-button" onClick={() => { const series = tasks.find(task => task.id === editingTaskId); if (series) { const shown = editingOccurrenceDate ? materializeOccurrence(series, editingOccurrenceDate) : series; if (shown) setTaskStatus(shown, 'abandoned') }; closeEditor() }}>放弃任务</button>
                  <button type="button" className="delete-button" onClick={() => {
                    const series = tasks.find(task => task.id === editingTaskId)
                    if (!series) return
                    if (editingOccurrenceDate && series.recurrence) setSeriesAction('delete')
                    else { deleteTask(series, 'series'); closeEditor() }
                  }}>删除</button>
                </div>
              )}
              <div className="editor-primary-actions">
                <button className="cancel-button" type="button" onClick={closeEditor}>取消</button>
                <button className="save-button" type="button" onClick={() => {
                  const series = editingTaskId ? tasks.find(task => task.id === editingTaskId) : null
                  if (editingOccurrenceDate && series?.recurrence && draft.repeatPreset === 'none') setConfirmSingleTask(true)
                  else if (editingOccurrenceDate && series?.recurrence) setSeriesAction('save')
                  else saveTask('series')
                }} disabled={!draft.title.trim()}>{editingTaskId ? '保存修改' : '保存任务'}</button>
              </div>
            </div>
          </section>
        </div>
      )}
      {confirmSingleTask && editingTaskId && editingOccurrenceDate && (
        <div className="scope-layer" role="presentation">
          <button className="scope-backdrop" type="button" aria-label="关闭" onClick={() => setConfirmSingleTask(false)} />
          <section className="scope-dialog" role="dialog" aria-modal="true">
            <h3>改为单次任务？</h3>
            <p>当前重复系列将在这次任务之前结束；当前这次会保留为单次任务，此前的任务记录保留，之后的重复任务不再生成。</p>
            <div className="scope-actions">
              <button type="button" onClick={() => setConfirmSingleTask(false)}>取消</button>
              <button type="button" className="save-button" onClick={convertOccurrenceToSingleTask}>改为单次任务</button>
            </div>
          </section>
        </div>
      )}

      {seriesAction && editingTaskId && editingOccurrenceDate && (
        <div className="scope-layer" role="presentation">
          <button className="scope-backdrop" type="button" aria-label="关闭" onClick={() => setSeriesAction(null)} />
          <section className="scope-dialog" role="dialog" aria-modal="true">
            <h3>{seriesAction === 'save' ? '修改重复任务' : '删除重复任务'}</h3>
            <p>{seriesAction === 'save' ? '这次修改应用到哪里？' : '要删除哪些重复任务？'}</p>
            <div className="scope-actions scope-actions-three">
              <button type="button" onClick={() => {
                if (seriesAction === 'save') saveTask('occurrence')
                else {
                  const series = tasks.find(t => t.id === editingTaskId)
                  const shown = series ? materializeOccurrence(series, editingOccurrenceDate) : null
                  if (shown) deleteTask(shown, 'occurrence')
                  closeEditor()
                }
                setSeriesAction(null)
              }}>仅本次</button>
              <button type="button" onClick={() => {
                if (seriesAction === 'save') saveTask('future')
                else {
                  const series = tasks.find(t => t.id === editingTaskId)
                  const shown = series ? materializeOccurrence(series, editingOccurrenceDate) : null
                  if (shown) deleteTask(shown, 'future')
                  closeEditor()
                }
                setSeriesAction(null)
              }}>本次及以后</button>
              <button type="button" className={seriesAction === 'delete' ? 'delete-button' : 'save-button'} onClick={() => {
                const series = tasks.find(t => t.id === editingTaskId)
                if (seriesAction === 'save') saveTask('series')
                else if (series) {
                  deleteTask(series, 'series')
                  closeEditor()
                }
                setSeriesAction(null)
              }}>整个系列</button>
            </div>
          </section>
        </div>
      )}

      {imageLibraryTarget && createPortal(
        <div className="storage-browser-layer attachment-library-layer" role="dialog" aria-modal="true" aria-label="从图片库选择">
          <button className="modal-backdrop" type="button" aria-label="关闭图片库" onClick={()=>setImageLibraryTarget(null)} />
          <section className="storage-browser attachment-library-modal">
            <header className="storage-browser-header"><div><span className="eyebrow">IMAGE LIBRARY</span><h2>从图片库选择</h2><small>复用已有图片，不会重复占用存储空间</small></div><button className="close-button" type="button" onClick={()=>setImageLibraryTarget(null)}>×</button></header>
            {libraryImages.length===0 ? <p className="page-empty">图片库还是空的。</p> : <div className="storage-image-grid selectable-library-grid">{libraryImages.map(attachment => {
              const selected = imageLibraryTarget==='task' ? draft.attachments.some(a=>a.storageKey===attachment.storageKey) : journalDraft.attachments.some(a=>a.storageKey===attachment.storageKey)
              return <div className={`library-pick-item ${selected?'selected':''}`} key={attachment.storageKey}><StorageImage attachment={attachment} onPreview={()=>chooseLibraryImage(attachment)} />{selected && <span className="library-picked-mark">✓ 已引用</span>}</div>
            })}</div>}
          </section>
        </div>,
        document.body
      )}

      {imagePreview && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={imagePreview.name}>
          <button className="image-lightbox-backdrop" type="button" aria-label="关闭图片" onClick={closeImagePreview} />
          <img src={imagePreview.url} alt={imagePreview.name} />
          <button className="image-lightbox-close" type="button" onClick={closeImagePreview} aria-label="关闭">×</button>
        </div>
      )}
    </main>
  )
}

export default App
