import type { SyncEntityType } from '../db/calendar'

export type SyncDiffOperation = {
  entityType: SyncEntityType
  entityId: string
  operation: 'upsert' | 'delete'
}

export function syncEntityKey(entityType: SyncEntityType, entityId: string) {
  return `${entityType}:${entityId}`
}

export function rowSyncId(entityType: SyncEntityType, row: any): string {
  return entityType === 'mood' || entityType === 'energy' || entityType === 'environment'
    ? String(row.date)
    : String(row.id)
}

export function planSyncDiff(entityType: SyncEntityType, previousRows: any[], nextRows: any[]): SyncDiffOperation[] {
  const previous = new Map(previousRows.map(row => [rowSyncId(entityType, row), row]))
  const next = new Map(nextRows.map(row => [rowSyncId(entityType, row), row]))
  const operations: SyncDiffOperation[] = []

  for (const [id, row] of next) {
    const before = previous.get(id)
    if (before && JSON.stringify(before) === JSON.stringify(row)) continue
    operations.push({ entityType, entityId: id, operation: 'upsert' })
  }
  for (const id of previous.keys()) {
    if (!next.has(id)) operations.push({ entityType, entityId: id, operation: 'delete' })
  }
  return operations
}
