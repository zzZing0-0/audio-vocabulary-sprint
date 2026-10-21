import type { Tag, Task } from '../types'
import { DEFAULT_TAG_ID, isImportSourceTagId } from './preferences'
import { sortTagsByColor } from './tags'

export type InboxSortKey = 'time' | 'priority' | 'tag'
export const DEFAULT_INBOX_SORT_ORDER: InboxSortKey[] = ['time', 'priority', 'tag']

export function normalizeInboxSortOrder(value: unknown): InboxSortKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_INBOX_SORT_ORDER]
  const allowed: InboxSortKey[] = ['time', 'priority', 'tag']
  const unique = value.filter((item, index): item is InboxSortKey =>
    typeof item === 'string' && allowed.includes(item as InboxSortKey) && value.indexOf(item) === index,
  )
  return unique.length === allowed.length ? unique : [...DEFAULT_INBOX_SORT_ORDER]
}

export function moveInboxSortKey(order: InboxSortKey[], from: InboxSortKey, to: InboxSortKey) {
  const normalized = normalizeInboxSortOrder(order)
  if (from === to) return normalized
  const next = normalized.filter(key => key !== from)
  const target = next.indexOf(to)
  next.splice(target < 0 ? next.length : target, 0, from)
  return next
}

export function inboxActivityAt(task: Task) {
  return task.updatedAt || task.createdAt
}

export function inboxActivityKind(task: Task): 'created' | 'updated' {
  return task.updatedAt && task.updatedAt !== task.createdAt ? 'updated' : 'created'
}

export function inboxOrdinaryTaskTagId(task: Task) {
  return (task.tagIds ?? []).find(id => !isImportSourceTagId(id)) ?? DEFAULT_TAG_ID
}

function tagRankMap(tags: Tag[]) {
  return new Map(sortTagsByColor(tags.filter(tag => !tag.archived && !isImportSourceTagId(tag.id)), tags).map((tag, index) => [tag.id, index]))
}

export function compareInboxTasks(a: Task, b: Task, order: InboxSortKey[], tags: Tag[]) {
  const ranks = tagRankMap(tags)
  for (const key of normalizeInboxSortOrder(order)) {
    let difference = 0
    if (key === 'time') difference = inboxActivityAt(b).localeCompare(inboxActivityAt(a))
    if (key === 'priority') difference = b.priority - a.priority
    if (key === 'tag') difference = (ranks.get(inboxOrdinaryTaskTagId(a)) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(inboxOrdinaryTaskTagId(b)) ?? Number.MAX_SAFE_INTEGER)
    if (difference) return difference
  }
  return a.id.localeCompare(b.id)
}

export type InboxTaskGroup = { key: string; label: string; color?: string; tasks: Task[] }

export function groupInboxTodoTasks(tasks: Task[], order: InboxSortKey[], tags: Tag[]): InboxTaskGroup[] {
  const sorted = [...tasks].sort((a, b) => compareInboxTasks(a, b, order, tags))
  const primary = normalizeInboxSortOrder(order)[0]
  if (primary === 'time') return sorted.length ? [{ key: 'time', label: '最近更新', tasks: sorted }] : []
  const tagMap = new Map(tags.map(tag => [tag.id, tag]))
  const groups = new Map<string, InboxTaskGroup>()
  for (const task of sorted) {
    const id = primary === 'priority' ? String(task.priority) : inboxOrdinaryTaskTagId(task)
    const label = primary === 'priority'
      ? `P${task.priority} · ${['从容', '普通', '较高', '紧急'][task.priority]}`
      : `${tagMap.get(id)?.name ?? '默认'}`
    const color = primary === 'priority'
      ? ['#789c86', '#d3b64b', '#d88b48', '#c8665f'][task.priority]
      : tagMap.get(id)?.color
    const existing = groups.get(id)
    if (existing) existing.tasks.push(task)
    else groups.set(id, { key: id, label, color, tasks: [task] })
  }
  return [...groups.values()]
}

export function sortCompletedInboxTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => (b.completedAt || b.updatedAt || b.createdAt).localeCompare(a.completedAt || a.updatedAt || a.createdAt) || a.id.localeCompare(b.id))
}
