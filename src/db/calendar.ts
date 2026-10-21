const DB_NAME = 'zing-calendar'
const DB_VERSION = 10
const TASK_STORE = 'tasks'
const JOURNAL_STORE = 'journalEntries'
const MOOD_STORE = 'dailyMoods'
const ENERGY_STORE = 'dailyEnergy'
const ENVIRONMENT_STORE = 'dailyEnvironment'
const PERIOD_STORE = 'menstrualPeriods'
const TAG_STORE = 'tags'
const ATTACHMENT_STORE = 'attachments'
const ANNIVERSARY_STORE = 'anniversaries'
const FOCUS_STORE = 'focusSessions'
const SETTINGS_STORE = 'userSettings'
const SYNC_META_STORE = 'syncMetadata'
const SYNC_TOMBSTONE_STORE = 'syncTombstones'
const SYNC_CHANGE_STORE = 'syncChanges'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TASK_STORE)) db.createObjectStore(TASK_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(JOURNAL_STORE)) db.createObjectStore(JOURNAL_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(MOOD_STORE)) db.createObjectStore(MOOD_STORE, { keyPath: 'date' })
      if (!db.objectStoreNames.contains(ENERGY_STORE)) db.createObjectStore(ENERGY_STORE, { keyPath: 'date' })
      if (!db.objectStoreNames.contains(ENVIRONMENT_STORE)) db.createObjectStore(ENVIRONMENT_STORE, { keyPath: 'date' })
      if (!db.objectStoreNames.contains(PERIOD_STORE)) db.createObjectStore(PERIOD_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(TAG_STORE)) db.createObjectStore(TAG_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) db.createObjectStore(ATTACHMENT_STORE)
      if (!db.objectStoreNames.contains(ANNIVERSARY_STORE)) db.createObjectStore(ANNIVERSARY_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(FOCUS_STORE)) db.createObjectStore(FOCUS_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(SYNC_META_STORE)) db.createObjectStore(SYNC_META_STORE, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(SYNC_TOMBSTONE_STORE)) db.createObjectStore(SYNC_TOMBSTONE_STORE, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(SYNC_CHANGE_STORE)) {
        const changes = db.createObjectStore(SYNC_CHANGE_STORE, { keyPath: 'sequence', autoIncrement: true })
        changes.createIndex('byEntity', ['entityType', 'entityId'], { unique: false })
        changes.createIndex('byChangedAt', 'changedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase()
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly')
      const request = transaction.objectStore(storeName).getAll()
      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function replaceAll<T>(storeName: string, rows: T[]): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      store.clear()
      rows.forEach(row => store.put(row))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export const loadAnniversaries = <T,>() => loadAll<T>(ANNIVERSARY_STORE)
export const saveAnniversaries = <T,>(rows: T[]) => replaceAll(ANNIVERSARY_STORE, rows)
export const loadTasks = <T,>() => loadAll<T>(TASK_STORE)
export const saveTasks = <T,>(rows: T[]) => replaceAll(TASK_STORE, rows)
export const loadJournalEntries = <T,>() => loadAll<T>(JOURNAL_STORE)
export const saveJournalEntries = <T,>(rows: T[]) => replaceAll(JOURNAL_STORE, rows)
export const loadDailyMoods = <T,>() => loadAll<T>(MOOD_STORE)
export const saveDailyMoods = <T,>(rows: T[]) => replaceAll(MOOD_STORE, rows)
export const loadDailyEnergy = <T,>() => loadAll<T>(ENERGY_STORE)
export const saveDailyEnergy = <T,>(rows: T[]) => replaceAll(ENERGY_STORE, rows)
export const loadDailyEnvironment = <T,>() => loadAll<T>(ENVIRONMENT_STORE)
export const saveDailyEnvironment = <T,>(rows: T[]) => replaceAll(ENVIRONMENT_STORE, rows)
export const loadMenstrualPeriods = <T,>() => loadAll<T>(PERIOD_STORE)
export const saveMenstrualPeriods = <T,>(rows: T[]) => replaceAll(PERIOD_STORE, rows)

export const loadTags = <T,>() => loadAll<T>(TAG_STORE)
export const saveTags = <T,>(rows: T[]) => replaceAll(TAG_STORE, rows)
export const loadFocusSessions = <T,>() => loadAll<T>(FOCUS_STORE)
export const saveFocusSessions = <T,>(rows: T[]) => replaceAll(FOCUS_STORE, rows)
export const loadUserSettings = <T,>() => loadAll<T>(SETTINGS_STORE)
export const saveUserSettings = <T,>(rows: T[]) => replaceAll(SETTINGS_STORE, rows)

export async function putAttachmentBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDatabase()
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction(ATTACHMENT_STORE, 'readwrite'); tx.objectStore(ATTACHMENT_STORE).put(blob, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) } finally { db.close() }
}
export async function getAttachmentBlob(key: string): Promise<Blob | undefined> {
  const db = await openDatabase()
  try { return await new Promise((resolve, reject) => { const req = db.transaction(ATTACHMENT_STORE, 'readonly').objectStore(ATTACHMENT_STORE).get(key); req.onsuccess = () => resolve(req.result as Blob | undefined); req.onerror = () => reject(req.error) }) } finally { db.close() }
}
export async function deleteAttachmentBlob(key: string): Promise<void> {
  const db = await openDatabase()
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction(ATTACHMENT_STORE, 'readwrite'); tx.objectStore(ATTACHMENT_STORE).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) } finally { db.close() }
}

export type ZingStorageStats = { total:number; images:number; audio:number; data:number; attachmentCount:number }
export async function getStorageStats(): Promise<ZingStorageStats> {
  const db = await openDatabase()
  try {
    const blobs = await new Promise<Blob[]>((resolve,reject) => {
      const req = db.transaction(ATTACHMENT_STORE,'readonly').objectStore(ATTACHMENT_STORE).getAll()
      req.onsuccess=()=>resolve((req.result ?? []) as Blob[])
      req.onerror=()=>reject(req.error)
    })
    let images=0, audio=0
    blobs.forEach(blob => { if (blob.type.startsWith('image/')) images += blob.size; else if (blob.type.startsWith('audio/')) audio += blob.size })
    let data=0
    for (const storeName of [TASK_STORE,JOURNAL_STORE,MOOD_STORE,ENERGY_STORE,ENVIRONMENT_STORE,PERIOD_STORE,TAG_STORE,ANNIVERSARY_STORE,FOCUS_STORE,SETTINGS_STORE]) {
      const rows = await loadAll<any>(storeName)
      data += new Blob([JSON.stringify(rows)]).size
    }
    return { total:images+audio+data, images, audio, data, attachmentCount:blobs.length }
  } finally { db.close() }
}

export async function cleanupOrphanAttachmentBlobs(referencedKeys: string[]): Promise<number> {
  const db = await openDatabase()
  try {
    const referenced = new Set(referencedKeys)
    return await new Promise<number>((resolve,reject) => {
      const tx = db.transaction(ATTACHMENT_STORE,'readwrite')
      const store = tx.objectStore(ATTACHMENT_STORE)
      const request = store.openCursor()
      let removed = 0
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        if (!referenced.has(String(cursor.key))) {
          cursor.delete()
          removed += 1
        }
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve(removed)
      tx.onerror = () => reject(tx.error)
    })
  } finally { db.close() }
}


// ---- v0.9 sync-ready foundation -------------------------------------------
// These stores are intentionally passive in v0.9.0: existing local CRUD keeps
// working exactly as before. Later sync releases can use this metadata without
// changing the user's task/journal data model or exposing credentials client-side.

export type SyncEntityType = 'task' | 'journal' | 'mood' | 'energy' | 'environment' | 'period' | 'tag' | 'anniversary' | 'focus' | 'settings'
export type SyncOperation = 'upsert' | 'delete'

export type SyncChange = {
  sequence?: number
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  changedAt: string
  deviceId: string
}

export type SyncTombstone = {
  key: string
  entityType: SyncEntityType
  entityId: string
  deletedAt: string
  deviceId: string
}

export type SyncState = {
  key: 'state'
  schemaVersion: 1
  deviceId: string
  lastPulledCursor?: string
  lastPushedSequence?: number
  lastSuccessfulSyncAt?: string
}

const DEVICE_ID_STORAGE_KEY = 'zing:deviceId'

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) return existing
  const id = `device:${crypto.randomUUID()}`
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, id)
  return id
}

export async function loadSyncState(): Promise<SyncState> {
  const db = await openDatabase()
  try {
    const stored = await new Promise<SyncState | undefined>((resolve, reject) => {
      const req = db.transaction(SYNC_META_STORE, 'readonly').objectStore(SYNC_META_STORE).get('state')
      req.onsuccess = () => resolve(req.result as SyncState | undefined)
      req.onerror = () => reject(req.error)
    })
    if (stored) return stored
    const initial: SyncState = { key: 'state', schemaVersion: 1, deviceId: getOrCreateDeviceId() }
    await saveSyncState(initial)
    return initial
  } finally {
    db.close()
  }
}

export async function saveSyncState(state: SyncState): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SYNC_META_STORE, 'readwrite')
      tx.objectStore(SYNC_META_STORE).put(state)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function appendSyncChange(change: Omit<SyncChange, 'sequence'>): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SYNC_CHANGE_STORE, 'readwrite')
      tx.objectStore(SYNC_CHANGE_STORE).add(change)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function loadSyncChangesAfter(sequence = 0): Promise<SyncChange[]> {
  const rows = await loadAll<SyncChange>(SYNC_CHANGE_STORE)
  return rows
    .filter(row => (row.sequence ?? 0) > sequence)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
}

export async function saveSyncTombstone(tombstone: SyncTombstone): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SYNC_TOMBSTONE_STORE, 'readwrite')
      tx.objectStore(SYNC_TOMBSTONE_STORE).put(tombstone)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export const loadSyncTombstones = () => loadAll<SyncTombstone>(SYNC_TOMBSTONE_STORE)

export async function clearSyncTombstone(key: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SYNC_TOMBSTONE_STORE, 'readwrite')
      tx.objectStore(SYNC_TOMBSTONE_STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}



export type GitHubDeviceCredential = {
  key: 'githubCredential'
  token: string
  savedAt: string
}

export async function loadGitHubDeviceCredential(): Promise<GitHubDeviceCredential | undefined> {
  const db = await openDatabase()
  try {
    return await new Promise<GitHubDeviceCredential | undefined>((resolve, reject) => {
      const req = db.transaction(SYNC_META_STORE, 'readonly').objectStore(SYNC_META_STORE).get('githubCredential')
      req.onsuccess = () => resolve(req.result as GitHubDeviceCredential | undefined)
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}

export async function saveGitHubDeviceCredential(token: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SYNC_META_STORE, 'readwrite')
      tx.objectStore(SYNC_META_STORE).put({ key:'githubCredential', token, savedAt:new Date().toISOString() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

export async function clearGitHubDeviceCredential(): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SYNC_META_STORE, 'readwrite')
      tx.objectStore(SYNC_META_STORE).delete('githubCredential')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

// ---- v0.9.2 portable sync engine ------------------------------------------
// A transport-neutral bundle: later the same object can travel through an old
// Mac server, a hosted API, or another backend without changing merge semantics.

export type SyncEntityRecord = {
  entityType: SyncEntityType
  entityId: string
  updatedAt: string
  payload: any
}

export type SyncBundle = {
  protocolVersion: 1
  exportedAt: string
  deviceId: string
  records: SyncEntityRecord[]
  tombstones: SyncTombstone[]
}

function entityStoreName(entityType: SyncEntityType): string {
  if (entityType === 'task') return TASK_STORE
  if (entityType === 'journal') return JOURNAL_STORE
  if (entityType === 'mood') return MOOD_STORE
  if (entityType === 'energy') return ENERGY_STORE
  if (entityType === 'environment') return ENVIRONMENT_STORE
  if (entityType === 'period') return PERIOD_STORE
  if (entityType === 'tag') return TAG_STORE
  if (entityType === 'anniversary') return ANNIVERSARY_STORE
  if (entityType === 'focus') return FOCUS_STORE
  return SETTINGS_STORE
}

function entityIdOf(entityType: SyncEntityType, row: any): string {
  return entityType === 'mood' || entityType === 'energy' || entityType === 'environment' ? String(row.date) : String(row.id)
}

function entityUpdatedAt(row: any): string {
  return String(row.updatedAt ?? row.createdAt ?? '1970-01-01T00:00:00.000Z')
}

// Sync payloads are canonicalized before they leave a device. Optional attachment
// bookkeeping must have one wire representation; otherwise a device that hydrates
// defaults can create a cloud diff even when the user changed nothing.
function canonicalSyncPayload(entityType: SyncEntityType, row: any): any {
  if (entityType === 'task' || entityType === 'journal') {
    return { ...row, attachments: Array.isArray(row.attachments) ? row.attachments : [], attachmentLinkTombstones: row.attachmentLinkTombstones ?? {} }
  }
  return row
}

async function pruneStaleSyncTombstones(): Promise<number> {
  const tombstones = await loadSyncTombstones()
  if (!tombstones.length) return 0
  const liveTimes = new Map<string, number>()
  const entityTypes: SyncEntityType[] = ['task', 'journal', 'mood', 'energy', 'environment', 'period', 'tag', 'anniversary', 'focus', 'settings']
  for (const entityType of entityTypes) {
    const rows = await loadAll<any>(entityStoreName(entityType))
    rows.forEach(row => liveTimes.set(`${entityType}:${entityIdOf(entityType, row)}`, Date.parse(entityUpdatedAt(row)) || 0))
  }
  // A valid current bundle must never carry both a live record and its tombstone.
  // If both exist, the entity currently exists locally, so the tombstone is stale/polluted.
  const stale = tombstones.filter(t => liveTimes.has(t.key))
  for (const t of stale) await clearSyncTombstone(t.key)
  return stale.length
}

export async function createSyncBundle(): Promise<SyncBundle> {
  const deviceId = getOrCreateDeviceId()
  await pruneStaleSyncTombstones()
  const entityTypes: SyncEntityType[] = ['task', 'journal', 'mood', 'energy', 'environment', 'period', 'tag', 'anniversary', 'focus', 'settings']
  const records: SyncEntityRecord[] = []
  for (const entityType of entityTypes) {
    const rows = await loadAll<any>(entityStoreName(entityType))
    rows.forEach(row => records.push({
      entityType,
      entityId: entityIdOf(entityType, row),
      updatedAt: entityUpdatedAt(row),
      payload: canonicalSyncPayload(entityType, row),
    }))
  }
  return {
    protocolVersion: 1,
    exportedAt: new Date().toISOString(),
    deviceId,
    records,
    tombstones: await loadSyncTombstones(),
  }
}

export type SyncMergePlan = {
  upserts: SyncEntityRecord[]
  deletes: SyncTombstone[]
  ignoredRemoteRecords: number
  ignoredRemoteTombstones: number
}


function mergeConcurrentSettings(localRecord: SyncEntityRecord, remoteRecord: SyncEntityRecord): SyncEntityRecord {
  const localTime = Date.parse(localRecord.updatedAt) || 0
  const remoteTime = Date.parse(remoteRecord.updatedAt) || 0
  const newer = remoteTime > localTime ? remoteRecord : localRecord
  const normalizeClock = (record: SyncEntityRecord) => {
    const added: Record<string,string> = { ...(record.payload?.wordCloudIgnoredAddedAt ?? {}) }
    const removed: Record<string,string> = { ...(record.payload?.wordCloudIgnoredRemovedAt ?? {}) }
    const fallback = record.updatedAt || '1970-01-01T00:00:00.000Z'
    const words = Array.isArray(record.payload?.wordCloudIgnored) ? record.payload.wordCloudIgnored : []
    words.forEach((raw:any)=>{ const word=String(raw).trim().toLowerCase(); if(word&&!added[word]&&!removed[word]) added[word]=fallback })
    return { added, removed }
  }
  const localClock=normalizeClock(localRecord), remoteClock=normalizeClock(remoteRecord)
  const added:Record<string,string>={...localClock.added}
  const removed:Record<string,string>={...localClock.removed}
  Object.entries(remoteClock.added).forEach(([word,at])=>{ if(!added[word]||(Date.parse(at)||0)>(Date.parse(added[word])||0)) added[word]=at })
  Object.entries(remoteClock.removed).forEach(([word,at])=>{ if(!removed[word]||(Date.parse(at)||0)>(Date.parse(removed[word])||0)) removed[word]=at })
  const words=[...new Set([...Object.keys(added),...Object.keys(removed)])].filter(word=>(Date.parse(added[word]||'')||0)>(Date.parse(removed[word]||'')||0)).sort()
  const encouragementMap=new Map<string,any>()
  const mergeEncouragement=(raw:any)=>{ if(!raw||!raw.id)return; const current=encouragementMap.get(String(raw.id)); if(!current||(Date.parse(raw.updatedAt)||0)>(Date.parse(current.updatedAt)||0)) encouragementMap.set(String(raw.id),raw) }
  ;(Array.isArray(localRecord.payload?.encouragementMessages)?localRecord.payload.encouragementMessages:[]).forEach(mergeEncouragement)
  ;(Array.isArray(remoteRecord.payload?.encouragementMessages)?remoteRecord.payload.encouragementMessages:[]).forEach(mergeEncouragement)
  const encouragementMessages=[...encouragementMap.values()].sort((a,b)=>(Date.parse(a.updatedAt)||0)-(Date.parse(b.updatedAt)||0))
  const mergeEnvironmentOptions=(key:'weatherOptions'|'thermalOptions')=>{
    const map=new Map<string,any>()
    const merge=(raw:any)=>{ if(!raw?.id)return; const current=map.get(String(raw.id)); if(!current||(Date.parse(raw.updatedAt)||0)>(Date.parse(current.updatedAt)||0)) map.set(String(raw.id),raw) }
    ;(Array.isArray(localRecord.payload?.[key])?localRecord.payload[key]:[]).forEach(merge)
    ;(Array.isArray(remoteRecord.payload?.[key])?remoteRecord.payload[key]:[]).forEach(merge)
    return [...map.values()].sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0))
  }
  const weatherOptions=mergeEnvironmentOptions('weatherOptions'), thermalOptions=mergeEnvironmentOptions('thermalOptions')
  return { ...newer, updatedAt:new Date(Math.max(localTime,remoteTime)).toISOString(), payload:{...newer.payload,wordCloudIgnored:words,wordCloudIgnoredAddedAt:added,wordCloudIgnoredRemovedAt:removed,encouragementMessages,weatherOptions,thermalOptions} }
}

function mergeConcurrentAttachments(localRecord: SyncEntityRecord, remoteRecord: SyncEntityRecord): SyncEntityRecord {
  if (!['task','journal'].includes(localRecord.entityType) || localRecord.entityType !== remoteRecord.entityType) {
    return (Date.parse(remoteRecord.updatedAt)||0) > (Date.parse(localRecord.updatedAt)||0) ? remoteRecord : localRecord
  }
  const localTime = Date.parse(localRecord.updatedAt) || 0
  const remoteTime = Date.parse(remoteRecord.updatedAt) || 0
  const newer = remoteTime > localTime ? remoteRecord : localRecord
  const localItems = Array.isArray(localRecord.payload?.attachments) ? localRecord.payload.attachments : []
  const remoteItems = Array.isArray(remoteRecord.payload?.attachments) ? remoteRecord.payload.attachments : []
  const localDeletes: Record<string,string> = localRecord.payload?.attachmentLinkTombstones ?? {}
  const remoteDeletes: Record<string,string> = remoteRecord.payload?.attachmentLinkTombstones ?? {}
  const deletes: Record<string,string> = { ...localDeletes }
  Object.entries(remoteDeletes).forEach(([key, at]) => {
    if (!deletes[key] || (Date.parse(at)||0) > (Date.parse(deletes[key])||0)) deletes[key] = at
  })

  // storageKey identifies the shared immutable binary. A link deletion is an explicit
  // per-attachment tombstone; unrelated task edits can no longer erase a concurrent add.
  const candidates = new Map<string, any>()
  ;[...localItems, ...remoteItems].forEach((a:any) => {
    const key = String(a.storageKey || a.id)
    const previous = candidates.get(key)
    if (!previous || (Date.parse(a.createdAt)||0) > (Date.parse(previous.createdAt)||0)) candidates.set(key, a)
  })
  const merged = [...candidates.entries()].filter(([key, a]) => {
    const deletedAt = deletes[key]
    return !deletedAt || (Date.parse(a.createdAt)||0) > (Date.parse(deletedAt)||0)
  }).map(([,a])=>a).sort((a,b)=>(Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0))

  return { ...newer, updatedAt: new Date(Math.max(localTime,remoteTime)).toISOString(), payload: { ...newer.payload, attachments: merged, attachmentLinkTombstones: deletes } }
}

export async function planSyncMerge(remote: SyncBundle): Promise<SyncMergePlan> {
  if (remote.protocolVersion !== 1) throw new Error(`不支持的同步协议版本：${remote.protocolVersion}`)
  const local = await createSyncBundle()
  const localRecords = new Map(local.records.map(record => [`${record.entityType}:${record.entityId}`, record]))
  const localTombstones = new Map(local.tombstones.map(tombstone => [tombstone.key, tombstone]))
  const remoteRecords = new Map(remote.records.map(record => [`${record.entityType}:${record.entityId}`, record]))
  const upserts: SyncEntityRecord[] = []
  const deletes: SyncTombstone[] = []
  let ignoredRemoteRecords = 0
  let ignoredRemoteTombstones = 0

  for (const remoteRecord of remote.records) {
    const key = `${remoteRecord.entityType}:${remoteRecord.entityId}`
    const localRecord = localRecords.get(key)
    const localDelete = localTombstones.get(key)
    const remoteTime = Date.parse(remoteRecord.updatedAt) || 0
    const localTime = localRecord ? (Date.parse(localRecord.updatedAt) || 0) : 0
    const deleteTime = localDelete ? (Date.parse(localDelete.deletedAt) || 0) : 0

    // Task/journal attachment links are merged independently from the record-level LWW.
    // If one device removed an old attachment while another added a newer one, the old
    // link stays removed and the new link survives. The binary itself is immutable/shared.
    if (localRecord && remoteRecord.entityType === 'settings' && deleteTime <= Math.max(localTime, remoteTime)) {
      const merged = mergeConcurrentSettings(localRecord, remoteRecord)
      if (JSON.stringify(merged.payload) !== JSON.stringify(localRecord.payload)) upserts.push(merged)
      else ignoredRemoteRecords += 1
    } else if (localRecord && (remoteRecord.entityType === 'task' || remoteRecord.entityType === 'journal') && deleteTime <= Math.max(localTime, remoteTime)) {
      const merged = mergeConcurrentAttachments(localRecord, remoteRecord)
      if (JSON.stringify(merged.payload) !== JSON.stringify(localRecord.payload)) upserts.push(merged)
      else ignoredRemoteRecords += 1
    } else if (remoteTime > Math.max(localTime, deleteTime)) upserts.push(remoteRecord)
    else ignoredRemoteRecords += 1
  }

  for (const remoteDelete of remote.tombstones) {
    const key = remoteDelete.key
    const remoteRecord = remoteRecords.get(key)
    const remoteDeleteTime = Date.parse(remoteDelete.deletedAt) || 0
    // A bundle can contain an old tombstone plus a later recreated/live record.
    // Resolve that conflict inside the remote bundle before comparing with local state.
    if (remoteRecord) {
      ignoredRemoteTombstones += 1
      continue
    }
    const localRecord = localRecords.get(key)
    const localDelete = localTombstones.get(key)
    const localRecordTime = localRecord ? (Date.parse(localRecord.updatedAt) || 0) : 0
    const localDeleteTime = localDelete ? (Date.parse(localDelete.deletedAt) || 0) : 0
    if (remoteDeleteTime > Math.max(localRecordTime, localDeleteTime)) deletes.push(remoteDelete)
    else ignoredRemoteTombstones += 1
  }

  return { upserts, deletes, ignoredRemoteRecords, ignoredRemoteTombstones }
}

export async function applySyncMerge(plan: SyncMergePlan): Promise<void> {
  const db = await openDatabase()
  const stores = [TASK_STORE, JOURNAL_STORE, MOOD_STORE, ENERGY_STORE, ENVIRONMENT_STORE, PERIOD_STORE, TAG_STORE, ANNIVERSARY_STORE, FOCUS_STORE, SETTINGS_STORE, SYNC_TOMBSTONE_STORE]
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite')

      plan.upserts.forEach(record => {
        tx.objectStore(entityStoreName(record.entityType)).put(record.payload)
        tx.objectStore(SYNC_TOMBSTONE_STORE).delete(`${record.entityType}:${record.entityId}`)
      })

      plan.deletes.forEach(tombstone => {
        const store = tx.objectStore(entityStoreName(tombstone.entityType))
        store.delete(tombstone.entityId)
        tx.objectStore(SYNC_TOMBSTONE_STORE).put(tombstone)
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}


// ---- v0.9.3 sync transport -------------------------------------------------
// Backend contract:
//   GET  {baseUrl}/api/sync/bundle  -> SyncBundle
//   PUT  {baseUrl}/api/sync/bundle  <- SyncBundle, -> optional SyncBundle
// The client never embeds a GitHub token or server secret. Authentication can
// later be supplied by the deployment layer via headers/session cookies.

export type SyncTransportConfig = {
  baseUrl: string
  authToken?: string
}

export type SyncTransportResult = {
  remoteBundle?: SyncBundle
  status: number
}

function normalizeSyncBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function syncHeaders(config: SyncTransportConfig): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`
  return headers
}

export async function pullSyncBundle(config: SyncTransportConfig): Promise<SyncBundle> {
  const baseUrl = normalizeSyncBaseUrl(config.baseUrl)
  if (!baseUrl) throw new Error('同步服务器地址为空')
  const response = await fetch(`${baseUrl}/api/sync/bundle`, {
    method: 'GET',
    headers: syncHeaders(config),
  })
  if (!response.ok) throw new Error(`同步下载失败（HTTP ${response.status}）`)
  const bundle = await response.json() as SyncBundle
  if (bundle.protocolVersion !== 1) throw new Error(`不支持的同步协议版本：${bundle.protocolVersion}`)
  return bundle
}

export async function pushSyncBundle(config: SyncTransportConfig, bundle: SyncBundle): Promise<SyncTransportResult> {
  const baseUrl = normalizeSyncBaseUrl(config.baseUrl)
  if (!baseUrl) throw new Error('同步服务器地址为空')
  const response = await fetch(`${baseUrl}/api/sync/bundle`, {
    method: 'PUT',
    headers: { ...syncHeaders(config), 'Content-Type': 'application/json' },
    body: JSON.stringify(bundle),
  })
  if (!response.ok) throw new Error(`同步上传失败（HTTP ${response.status}）`)
  if (response.status === 204) return { status: response.status }
  const text = await response.text()
  return {
    status: response.status,
    remoteBundle: text ? JSON.parse(text) as SyncBundle : undefined,
  }
}

export type SyncRoundTripResult = {
  pulled: { upserts: number; deletes: number }
  pushedRecords: number
  pushedTombstones: number
  finishedAt: string
}

// Pull -> merge -> rebuild local bundle -> push.
// Keeping this orchestration in the data layer means UI and backend remain replaceable.
export async function syncRoundTrip(config: SyncTransportConfig): Promise<SyncRoundTripResult> {
  const remote = await pullSyncBundle(config)
  const plan = await planSyncMerge(remote)
  await applySyncMerge(plan)
  const mergedLocal = await createSyncBundle()
  await pushSyncBundle(config, mergedLocal)
  const finishedAt = new Date().toISOString()
  const state = await loadSyncState()
  await saveSyncState({ ...state, lastSuccessfulSyncAt: finishedAt })
  return {
    pulled: { upserts: plan.upserts.length, deletes: plan.deletes.length },
    pushedRecords: mergedLocal.records.length,
    pushedTombstones: mergedLocal.tombstones.length,
    finishedAt,
  }
}


// ---- v0.9.4 GitHub sync provider ------------------------------------------
// Stores the transport-neutral SyncBundle in a dedicated private GitHub repo.
// Authentication is deliberately injected at runtime and is never persisted by
// this provider. Do not put a PAT in source code, localStorage, or a public build.

export type GitHubSyncConfig = {
  owner: string
  repo: string
  branch?: string
  path?: string
  token: string
}

type GitHubContentsFile = {
  type: 'file'
  encoding?: string
  content?: string
  sha: string
  download_url?: string | null
}

const GITHUB_API_BASE = 'https://api.github.com'

function githubSyncPath(config: GitHubSyncConfig) {
  return (config.path?.trim() || 'zing/sync-bundle.json').replace(/^\/+/, '')
}

async function githubApiFetch(config: GitHubSyncConfig, url: string, init: RequestInit = {}): Promise<Response> {
  const target = new URL(url)
  if (target.origin !== GITHUB_API_BASE) throw new Error('GitHub 同步目标地址无效')
  const method = String(init.method || 'GET').toUpperCase()
  const requestBody = typeof init.body === 'string' ? init.body : undefined

  let response: Response
  try {
    response = await fetch('/api/github-sync', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        token: config.token,
        method,
        path: `${target.pathname}${target.search}`,
        body: requestBody,
      }),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`GitHub 同步代理无法连接（${detail || '网络请求失败'}）`)
  }

  // A 502 here means Vercel reached the proxy function but the function itself
  // could not reach GitHub. Preserve the diagnostic message instead of collapsing
  // it into Safari's "Load failed" / Chromium's "Failed to fetch".
  if (response.status === 502) {
    let detail = ''
    try {
      const payload = await response.clone().json() as { error?: unknown }
      detail = String(payload.error || '')
    } catch {}
    throw new Error(`GitHub 同步代理连接 GitHub 失败${detail ? ` · ${detail}` : ''}`)
  }
  return response
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToUtf8(value: string): string {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function readGitHubBundleFile(config: GitHubSyncConfig): Promise<{ bundle?: SyncBundle; sha?: string }> {
  const branch = config.branch?.trim() || 'main'
  const path = githubSyncPath(config)
  const contentsUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`

  // Contents API is used only to resolve the file and its blob SHA.
  const metaResponse = await githubApiFetch(config, contentsUrl)
  if (metaResponse.status === 404) return {}
  if (!metaResponse.ok) {
    const detail = (await metaResponse.text()).slice(0, 180).replace(/\s+/g, ' ')
    throw new Error(`GitHub 同步读取失败（HTTP ${metaResponse.status}${detail ? ` · ${detail}` : ''}）`)
  }
  const file = await metaResponse.json() as GitHubContentsFile
  if (file.type !== 'file') throw new Error('GitHub 同步路径不是文件')
  if (!file.sha) throw new Error('GitHub 同步文件缺少 SHA')

  let rawJson: string

  // Contents API includes base64 content for small files.
  if (file.encoding === 'base64' && typeof file.content === 'string' && file.content.length > 0) {
    rawJson = base64ToUtf8(file.content)
  } else {
    // Large Contents API responses omit `content`. Fetch the underlying Git blob
    // by SHA instead. The Git Blobs endpoint returns base64 JSON reliably and
    // remains on api.github.com with the same fine-grained token authentication.
    const blobUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/git/blobs/${encodeURIComponent(file.sha)}`
    const blobResponse = await githubApiFetch(config, blobUrl)
    if (!blobResponse.ok) {
      const detail = (await blobResponse.text()).slice(0, 180).replace(/\s+/g, ' ')
      throw new Error(`GitHub 同步 Blob 读取失败（HTTP ${blobResponse.status}${detail ? ` · ${detail}` : ''}）`)
    }
    const blob = await blobResponse.json() as { sha?: string; encoding?: string; content?: string; size?: number }
    if (blob.encoding !== 'base64' || typeof blob.content !== 'string' || !blob.content) {
      throw new Error(`GitHub 同步 Blob 格式异常（encoding=${String(blob.encoding)}；size=${String(blob.size)}）`)
    }
    rawJson = base64ToUtf8(blob.content)
  }

  let parsed: any
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('GitHub 同步文件 JSON 无法解析')
  }

  if (!parsed || typeof parsed !== 'object') throw new Error('GitHub 同步文件结构无效（不是对象）')
  if (parsed.protocolVersion !== 1) {
    const keys = Object.keys(parsed).slice(0, 8).join(',')
    throw new Error(`GitHub 同步协议无效（protocolVersion=${String(parsed.protocolVersion)}；字段：${keys || '空'}）`)
  }
  if (!Array.isArray(parsed.records) || !Array.isArray(parsed.tombstones)) {
    throw new Error('GitHub 同步文件结构无效（缺少 records/tombstones）')
  }

  return { bundle: parsed as SyncBundle, sha: file.sha }
}
async function writeGitHubBundleFile(config: GitHubSyncConfig, bundle: SyncBundle, sha?: string): Promise<'ok' | 'conflict'> {
  const branch = config.branch?.trim() || 'main'
  const path = githubSyncPath(config)
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`
  const body: Record<string, unknown> = {
    message: `sync: Zing data ${new Date().toISOString()}`,
    branch,
    content: utf8ToBase64(JSON.stringify(bundle)),
  }
  if (sha) body.sha = sha
  const response = await githubApiFetch(config, url, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (response.ok) return 'ok'
  if (response.status === 409 || response.status === 422) return 'conflict'
  const detail = (await response.text()).slice(0, 180).replace(/\s+/g, ' ')
  throw new Error(`GitHub 同步写入失败（HTTP ${response.status}${detail ? ` · ${detail}` : ''}）`)
}


export type SyncAttachmentMeta = {
  storageKey: string
  mimeType: string
  size: number
}

function attachmentMetasFromBundle(bundle: SyncBundle): SyncAttachmentMeta[] {
  const byKey = new Map<string, SyncAttachmentMeta>()
  const add = (items: any) => {
    if (!Array.isArray(items)) return
    items.forEach((item: any) => {
      const storageKey = String(item?.storageKey ?? '')
      if (!storageKey) return
      byKey.set(storageKey, {
        storageKey,
        mimeType: String(item?.mimeType ?? 'application/octet-stream'),
        size: Number(item?.size ?? 0) || 0,
      })
    })
  }
  bundle.records.forEach(record => {
    if (record.entityType === 'task') {
      add(record.payload?.attachments)
      Object.values(record.payload?.recurrenceExceptions ?? {}).forEach((exception: any) => add(exception?.attachments))
    } else if (record.entityType === 'journal') add(record.payload?.attachments)
  })
  return [...byKey.values()]
}

type B2SignedUrl = { url: string }

async function signedB2Url(storageKey: string, method: 'GET'|'HEAD'|'PUT'): Promise<string> {
  const response = await fetch(`/api/b2-sign?key=${encodeURIComponent(storageKey)}&method=${method}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  if (!response.ok) {
    let detail = ''
    try { detail = String((JSON.parse(raw) as { error?: unknown }).error || '') } catch { detail = raw.slice(0, 120).replace(/\s+/g, ' ') }
    throw new Error(`B2 签名失败（HTTP ${response.status}${detail ? ` · ${detail}` : ''} · ${storageKey}）`)
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`B2 签名接口未作为 Vercel Function 运行（返回 ${contentType || '未知内容类型'}）`)
  }
  let payload: B2SignedUrl
  try { payload = JSON.parse(raw) as B2SignedUrl }
  catch { throw new Error(`B2 签名接口返回了无效 JSON（${storageKey}）`) }
  if (!payload.url) throw new Error(`B2 签名响应异常（${storageKey}）`)
  return payload.url
}

async function readB2Attachment(meta: SyncAttachmentMeta): Promise<Blob | undefined> {
  let url: string
  try { url = await signedB2Url(meta.storageKey, 'GET') }
  catch (error) { throw new Error(`B2 GET 签名失败 · ${meta.storageKey} · ${error instanceof Error ? error.message : String(error)}`) }
  let response: Response
  try { response = await fetch(url, { method: 'GET', cache: 'no-store' }) }
  catch (error) { throw new Error(`B2 GET 网络失败 · ${meta.storageKey} · ${error instanceof Error ? error.message : String(error)}`) }
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`B2 附件读取失败（HTTP ${response.status} · ${meta.storageKey}）`)
  return await response.blob()
}

async function writeB2Attachment(meta: SyncAttachmentMeta, blob: Blob): Promise<void> {
  let url: string
  try { url = await signedB2Url(meta.storageKey, 'PUT') }
  catch (error) { throw new Error(`B2 PUT 签名失败 · ${meta.storageKey} · ${error instanceof Error ? error.message : String(error)}`) }
  let response: Response
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || meta.mimeType || 'application/octet-stream' },
      body: blob,
    })
  } catch (error) {
    throw new Error(`B2 PUT 网络失败 · ${meta.storageKey} · ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!response.ok) throw new Error(`B2 附件上传失败（HTTP ${response.status} · ${meta.storageKey}）`)
}

async function syncB2Attachments(bundle: SyncBundle): Promise<{ uploaded: number; downloaded: number; missing: number }> {
  const result = { uploaded: 0, downloaded: 0, missing: 0 }
  const metas = attachmentMetasFromBundle(bundle)
  for (const meta of metas) {
    const local = await getAttachmentBlob(meta.storageKey)
    // Avoid HEAD entirely. Safari/Chromium were both failing on the extra presigned
    // HEAD/CORS round trip. A single GET tells us both existence and supplies the blob
    // when this device does not have it.
    const remote = await readB2Attachment(meta)
    if (remote) {
      if (!local) {
        await putAttachmentBlob(meta.storageKey, remote)
        result.downloaded += 1
      }
      continue
    }
    if (local) {
      await writeB2Attachment(meta, local)
      result.uploaded += 1
    } else result.missing += 1
  }
  return result
}


export type GitHubSyncPreview = {
  initializedRemote: boolean
  rows: {
    entityType: SyncEntityType | 'trash'
    localCount: number
    remoteCount: number
    mergedCount: number
    added: number
    updated: number
    deleted: number
  }[]
}

type TrashPreviewItem = { key: string; trashedAt: string }

function trashPreviewItems(records: SyncEntityRecord[]): TrashPreviewItem[] {
  const items: TrashPreviewItem[] = []
  records.forEach(record => {
    const row = record.payload ?? {}
    if (record.entityType === 'task') {
      if (row.trashedAt) {
        items.push({ key: `task:series:${record.entityId}`, trashedAt: String(row.trashedAt) })
        return
      }
      if (row.trashFuture?.from && row.trashFuture?.trashedAt) {
        items.push({ key: `task:future:${record.entityId}:${row.trashFuture.from}`, trashedAt: String(row.trashFuture.trashedAt) })
      }
      Object.entries(row.recurrenceExceptions ?? {}).forEach(([date, exception]: [string, any]) => {
        if (exception?.trashedAt) items.push({ key: `task:occurrence:${record.entityId}:${date}`, trashedAt: String(exception.trashedAt) })
      })
    } else if ((record.entityType === 'journal' || record.entityType === 'anniversary') && row.trashedAt) {
      items.push({ key: `${record.entityType}:${record.entityId}`, trashedAt: String(row.trashedAt) })
    }
  })
  return items
}

function recordVisibleOutsideTrash(record: SyncEntityRecord | undefined): boolean {
  if (!record) return false
  if (record.entityType === 'task' || record.entityType === 'journal' || record.entityType === 'anniversary') return !record.payload?.trashedAt
  return true
}

function payloadForNormalPreview(record: SyncEntityRecord): any {
  const payload = record.payload ?? {}
  if (record.entityType === 'journal' || record.entityType === 'anniversary') {
    const { trashedAt: _trashedAt, updatedAt: _updatedAt, ...rest } = payload
    return rest
  }
  if (record.entityType !== 'task') {
    const { updatedAt: _updatedAt, ...rest } = payload
    return rest
  }
  const { trashedAt: _trashedAt, trashFuture: _trashFuture, recurrenceExceptions, updatedAt: _updatedAt, ...rest } = payload
  const cleanExceptions = Object.fromEntries(Object.entries(recurrenceExceptions ?? {}).map(([date, value]: [string, any]) => {
    if (!value || typeof value !== 'object') return [date, value]
    const { trashedAt: _exceptionTrashedAt, updatedAt: _exceptionUpdatedAt, ...clean } = value
    return [date, clean]
  }))
  return { ...rest, recurrenceExceptions: cleanExceptions }
}

export async function previewGitHubSync(config: GitHubSyncConfig): Promise<GitHubSyncPreview> {
  if (!config.owner.trim() || !config.repo.trim()) throw new Error('GitHub 数据仓库信息不完整')
  if (!config.token.trim()) throw new Error('GitHub 访问令牌为空')
  const remote = await readGitHubBundleFile(config)
  const local = await createSyncBundle()
  const types: SyncEntityType[] = ['task','journal','mood','energy','environment','period','tag','anniversary','focus','settings']

  if (!remote.bundle) {
    const normalRows = types.map(entityType => {
      const localRecords = local.records.filter(record => record.entityType === entityType && recordVisibleOutsideTrash(record))
      const localCount = localRecords.length
      return { entityType, localCount, remoteCount: 0, mergedCount: localCount, added: localCount, updated: 0, deleted: 0 }
    })
    const localTrashCount = trashPreviewItems(local.records).length
    return {
      initializedRemote: true,
      rows: [...normalRows, { entityType:'trash' as const, localCount:localTrashCount, remoteCount:0, mergedCount:localTrashCount, added:localTrashCount, updated:0, deleted:0 }],
    }
  }

  const localRecords = new Map(local.records.map(record => [`${record.entityType}:${record.entityId}`, record]))
  const remoteRecords = new Map(remote.bundle.records.map(record => [`${record.entityType}:${record.entityId}`, record]))
  const localDeletes = new Map(local.tombstones.map(tombstone => [tombstone.key, tombstone]))
  const remoteDeletes = new Map(remote.bundle.tombstones.map(tombstone => [tombstone.key, tombstone]))
  const mergedRecords: SyncEntityRecord[] = []

  const rows: GitHubSyncPreview['rows'] = types.map(entityType => {
    const localTypeRecords = local.records.filter(record => record.entityType === entityType)
    const remoteTypeRecords = remote.bundle!.records.filter(record => record.entityType === entityType)
    const keys = new Set([
      ...localTypeRecords.map(record => `${entityType}:${record.entityId}`),
      ...remoteTypeRecords.map(record => `${entityType}:${record.entityId}`),
      ...local.tombstones.filter(t => t.entityType === entityType).map(t => t.key),
      ...remote.bundle!.tombstones.filter(t => t.entityType === entityType).map(t => t.key),
    ])

    let mergedCount = 0, added = 0, updated = 0, deleted = 0
    keys.forEach(key => {
      const localRecord = localRecords.get(key)
      const remoteRecord = remoteRecords.get(key)
      const localDelete = localDeletes.get(key)
      const remoteDelete = remoteDeletes.get(key)
      const localRecordTime = localRecord ? (Date.parse(localRecord.updatedAt) || 0) : 0
      const remoteRecordTime = remoteRecord ? (Date.parse(remoteRecord.updatedAt) || 0) : 0
      const localDeleteTime = localDelete ? (Date.parse(localDelete.deletedAt) || 0) : 0
      const remoteDeleteTime = remoteDelete ? (Date.parse(remoteDelete.deletedAt) || 0) : 0
      const newestDeleteTime = Math.max(localDeleteTime, remoteDeleteTime)
      const newestRecordTime = Math.max(localRecordTime, remoteRecordTime)

      let mergedRecord: SyncEntityRecord | undefined
      if (newestRecordTime >= newestDeleteTime && (localRecord || remoteRecord)) {
        if (localRecord && remoteRecord && (entityType === 'task' || entityType === 'journal')) mergedRecord = mergeConcurrentAttachments(localRecord, remoteRecord)
        else if (remoteRecordTime > localRecordTime) mergedRecord = remoteRecord
        else mergedRecord = localRecord ?? remoteRecord
      }
      if (mergedRecord) mergedRecords.push(mergedRecord)

      const localVisible = recordVisibleOutsideTrash(localRecord)
      const remoteVisible = recordVisibleOutsideTrash(remoteRecord)
      const mergedVisible = recordVisibleOutsideTrash(mergedRecord)
      if (mergedVisible) mergedCount += 1

      // Normal modules describe active data only. Recycle-bin lifecycle changes are
      // summarized separately below, so trashed records do not inflate active counts.
      if (mergedVisible && (!localVisible || !remoteVisible)) added += 1
      else if (!mergedVisible && (localVisible || remoteVisible)) deleted += 1
      else if (localVisible && remoteVisible && mergedVisible && localRecord && remoteRecord && JSON.stringify(payloadForNormalPreview(localRecord)) !== JSON.stringify(payloadForNormalPreview(remoteRecord))) updated += 1
      else if (!localRecord && !remoteRecord && Boolean(localDelete) !== Boolean(remoteDelete)) deleted += 1
      else if (!localRecord && !remoteRecord && localDelete && remoteDelete && localDelete.deletedAt !== remoteDelete.deletedAt) deleted += 1
    })

    return {
      entityType,
      localCount: localTypeRecords.filter(recordVisibleOutsideTrash).length,
      remoteCount: remoteTypeRecords.filter(recordVisibleOutsideTrash).length,
      mergedCount,
      added,
      updated,
      deleted,
    }
  })

  const localTrash = new Map(trashPreviewItems(local.records).map(item => [item.key, item]))
  const remoteTrash = new Map(trashPreviewItems(remote.bundle.records).map(item => [item.key, item]))
  const mergedTrash = new Map(trashPreviewItems(mergedRecords).map(item => [item.key, item]))
  const trashKeys = new Set([...localTrash.keys(), ...remoteTrash.keys(), ...mergedTrash.keys()])
  let trashAdded = 0, trashUpdated = 0, trashDeleted = 0
  trashKeys.forEach(key => {
    const localItem = localTrash.get(key), remoteItem = remoteTrash.get(key), mergedItem = mergedTrash.get(key)
    if (mergedItem && (!localItem || !remoteItem)) trashAdded += 1
    else if (!mergedItem && (localItem || remoteItem)) trashDeleted += 1
    else if (localItem && remoteItem && localItem.trashedAt !== remoteItem.trashedAt) trashUpdated += 1
  })
  rows.push({
    entityType:'trash',
    localCount:localTrash.size,
    remoteCount:remoteTrash.size,
    mergedCount:mergedTrash.size,
    added:trashAdded,
    updated:trashUpdated,
    deleted:trashDeleted,
  })

  return { initializedRemote: false, rows }
}

export type GitHubSyncResult = {
  initializedRemote: boolean
  pulled: { upserts: number; deletes: number }
  pushedRecords: number
  pushedTombstones: number
  attachments: { uploaded: number; downloaded: number; missing: number; total: number }
  attachmentWarning?: string
  finishedAt: string
}

export async function syncWithGitHub(config: GitHubSyncConfig): Promise<GitHubSyncResult> {
  if (!config.owner.trim() || !config.repo.trim()) throw new Error('GitHub 数据仓库信息不完整')
  if (!config.token.trim()) throw new Error('GitHub 访问令牌为空')

  const maxAttempts = 3
  let initializedRemote = false
  let totalPulledUpserts = 0
  let totalPulledDeletes = 0

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Every attempt re-reads both the latest remote bundle and its SHA.
    // If another device wrote between our GET and PUT, the next attempt
    // merges that new remote state before trying again.
    const remote = await readGitHubBundleFile(config)
    if (attempt === 1) initializedRemote = !remote.bundle

    if (remote.bundle) {
      const plan = await planSyncMerge(remote.bundle)
      await applySyncMerge(plan)
      totalPulledUpserts += plan.upserts.length
      totalPulledDeletes += plan.deletes.length
    }

    const mergedLocal = await createSyncBundle()
    // Commit the bundle first. Uploading separate attachment files also advances the
    // Git branch HEAD; doing those writes before the SHA-guarded bundle PUT made our
    // own attachment upload look like a concurrent-device conflict.
    const writeResult = await writeGitHubBundleFile(config, mergedLocal, remote.sha)

    if (writeResult === 'ok') {
      // Binary files are immutable by storageKey and live in private Backblaze B2.
      // GitHub is the structured-data ledger only; attachment binaries are no longer read from GitHub.
      let attachmentTransfer = { uploaded: 0, downloaded: 0, missing: 0 }
      let attachmentWarning: string | undefined
      try {
        attachmentTransfer = await syncB2Attachments(mergedLocal)
      } catch (error) {
        attachmentWarning = error instanceof Error ? error.message : String(error)
      }
      const finishedAt = new Date().toISOString()
      const state = await loadSyncState()
      await saveSyncState({ ...state, lastSuccessfulSyncAt: finishedAt })
      return {
        initializedRemote,
        pulled: { upserts: totalPulledUpserts, deletes: totalPulledDeletes },
        pushedRecords: mergedLocal.records.length,
        pushedTombstones: mergedLocal.tombstones.length,
        attachments: {
          ...attachmentTransfer,
          total: attachmentMetasFromBundle(mergedLocal).length,
        },
        attachmentWarning,
        finishedAt,
      }
    }
  }

  throw new Error(`GitHub 同步冲突：连续 ${maxAttempts} 次写入期间云端都发生变化，请稍后再同步`)
}


export async function clearZingUserDataWithSync(systemTags:any[]): Promise<void> {
  const db=await openDatabase()
  const entityStores: { entityType:SyncEntityType; storeName:string; id:(row:any)=>string; keep?:(row:any)=>boolean }[] = [
    {entityType:'task',storeName:TASK_STORE,id:row=>String(row.id)},
    {entityType:'journal',storeName:JOURNAL_STORE,id:row=>String(row.id)},
    {entityType:'mood',storeName:MOOD_STORE,id:row=>String(row.date)},
    {entityType:'energy',storeName:ENERGY_STORE,id:row=>String(row.date)},
    {entityType:'environment',storeName:ENVIRONMENT_STORE,id:row=>String(row.date)},
    {entityType:'period',storeName:PERIOD_STORE,id:row=>String(row.id)},
    {entityType:'tag',storeName:TAG_STORE,id:row=>String(row.id),keep:row=>systemTags.some(tag=>tag.id===row.id)},
    {entityType:'anniversary',storeName:ANNIVERSARY_STORE,id:row=>String(row.id)},
    {entityType:'focus',storeName:FOCUS_STORE,id:row=>String(row.id)},
  ]
  const stores=[...entityStores.map(item=>item.storeName),ATTACHMENT_STORE,SYNC_TOMBSTONE_STORE,SYNC_CHANGE_STORE]
  const deviceId=getOrCreateDeviceId(), now=new Date().toISOString()
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(stores,'readwrite')
      let pending=entityStores.length
      const finishOne=()=>{ pending-=1; if (pending!==0) return
        const tagStore=tx.objectStore(TAG_STORE); tagStore.clear(); systemTags.forEach(tag=>tagStore.put(tag))
        for (const item of entityStores) if (item.storeName!==TAG_STORE) tx.objectStore(item.storeName).clear()
        tx.objectStore(ATTACHMENT_STORE).clear()
      }
      entityStores.forEach(item=>{
        const req=tx.objectStore(item.storeName).getAll()
        req.onsuccess=()=>{
          for (const row of (req.result ?? [])) {
            if (item.keep?.(row)) continue
            const entityId=item.id(row), key=`${item.entityType}:${entityId}`
            tx.objectStore(SYNC_TOMBSTONE_STORE).put({key,entityType:item.entityType,entityId,deletedAt:now,deviceId} satisfies SyncTombstone)
            tx.objectStore(SYNC_CHANGE_STORE).add({entityType:item.entityType,entityId,operation:'delete',changedAt:now,deviceId} satisfies Omit<SyncChange,'sequence'>)
          }
          finishOne()
        }
        req.onerror=()=>reject(req.error)
      })
      tx.oncomplete=()=>resolve()
      tx.onerror=()=>reject(tx.error ?? new Error('清空事务失败'))
      tx.onabort=()=>reject(tx.error ?? new Error('清空事务已回滚'))
    })
  } finally { db.close() }
}

export async function replaceZingData(payload: {
  tasks:any[]; journals:any[]; moods:any[]; energies:any[]; environments:any[]; periods:any[]; tags:any[]; anniversaries:any[]; focusSessions:any[];
  attachments:{key:string;blob:Blob}[]
}): Promise<void> {
  const db=await openDatabase()
  const stores=[TASK_STORE,JOURNAL_STORE,MOOD_STORE,ENERGY_STORE,ENVIRONMENT_STORE,PERIOD_STORE,TAG_STORE,ANNIVERSARY_STORE,FOCUS_STORE,ATTACHMENT_STORE]
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(stores,'readwrite')
      const replace=(name:string,rows:any[])=>{ const store=tx.objectStore(name); store.clear(); rows.forEach(row=>store.put(row)) }
      replace(TASK_STORE,payload.tasks); replace(JOURNAL_STORE,payload.journals); replace(MOOD_STORE,payload.moods); replace(ENERGY_STORE,payload.energies); replace(ENVIRONMENT_STORE,payload.environments); replace(PERIOD_STORE,payload.periods)
      replace(TAG_STORE,payload.tags); replace(ANNIVERSARY_STORE,payload.anniversaries); replace(FOCUS_STORE,payload.focusSessions)
      const attachments=tx.objectStore(ATTACHMENT_STORE); attachments.clear()
      payload.attachments.forEach(item=>attachments.put(item.blob,item.key))
      tx.oncomplete=()=>resolve()
      tx.onerror=()=>reject(tx.error ?? new Error('恢复事务失败'))
      tx.onabort=()=>reject(tx.error ?? new Error('恢复事务已回滚'))
    })
  } finally { db.close() }
}
