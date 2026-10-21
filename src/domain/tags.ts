import type { Tag, TagScope } from '../types'
import { DEFAULT_TAG_ID, TAG_COLORS, isImportSourceTag, isImportSourceTagId } from './preferences'

export function singleOrdinaryTagIds(ids?: string[]) {
  const sourceIds = (ids ?? []).filter(isImportSourceTagId)
  const ordinary = (ids ?? []).find(id => id !== DEFAULT_TAG_ID && !isImportSourceTagId(id))
  return ordinary ? [ordinary, ...sourceIds] : [DEFAULT_TAG_ID, ...sourceIds]
}

export function toggleTaskTagIds(ids: string[], id: string) {
  const managed = ids.filter(isImportSourceTagId)
  const currentOrdinary = ids.find(tagId => tagId !== DEFAULT_TAG_ID && !isImportSourceTagId(tagId))
  if (id === DEFAULT_TAG_ID || currentOrdinary === id) return [DEFAULT_TAG_ID, ...managed]
  return [id, ...managed]
}

export function toggleJournalTagIds(ids: string[], id: string) {
  const managed = ids.filter(isImportSourceTagId)
  const real = ids.filter(tagId => tagId !== DEFAULT_TAG_ID && !isImportSourceTagId(tagId))
  if (id === DEFAULT_TAG_ID) return [DEFAULT_TAG_ID, ...managed]
  const next = real.includes(id) ? real.filter(tagId => tagId !== id) : [...real, id]
  return next.length ? [...next, ...managed] : [DEFAULT_TAG_ID, ...managed]
}

export function tagScopeLabel(scope: TagScope) {
  return scope === 'both' ? '共享标签' : scope === 'task' ? '任务标签' : '记录标签'
}

export function normalizedTagName(name: string) {
  return name.trim().toLocaleLowerCase()
}

export function tagNameTaken(tags: Tag[], name: string, exceptId?: string) {
  const normalized = normalizedTagName(name)
  return Boolean(normalized && tags.some(tag => tag.id !== exceptId && normalizedTagName(tag.name) === normalized))
}

export function tagColorRank(color: string) {
  const index = TAG_COLORS.findIndex(item => item.toLowerCase() === color.toLowerCase())
  return index >= 0 ? index : TAG_COLORS.length
}

export function sortTagsByColor(rows: Tag[], allTags: Tag[] = rows) {
  return [...rows].sort((a, b) => {
    if (a.id === DEFAULT_TAG_ID || b.id === DEFAULT_TAG_ID) return Number(b.id === DEFAULT_TAG_ID) - Number(a.id === DEFAULT_TAG_ID)
    const rankDiff = tagColorRank(a.color) - tagColorRank(b.color)
    if (rankDiff) return rankDiff
    const colorDiff = a.color.localeCompare(b.color)
    if (colorDiff) return colorDiff
    return (a.sortOrder ?? allTags.indexOf(a)) - (b.sortOrder ?? allTags.indexOf(b))
  })
}

export function tagsFor(tags: Tag[], kind: 'task' | 'journal') {
  return sortTagsByColor(
    tags.filter(tag => !isImportSourceTag(tag) && !tag.archived && (tag.scope === 'both' || tag.scope === kind)),
    tags,
  )
}

export function focusSelectableTags(tags: Tag[]) {
  return sortTagsByColor(
    tags.filter(tag => !isImportSourceTag(tag) && !tag.archived && (tag.id === DEFAULT_TAG_ID || tag.scope === 'both' || tag.scope === 'task')),
    tags,
  )
}

export function managedTagRows(tags: Tag[]) {
  return [...tags]
    .filter(tag => tag.id !== DEFAULT_TAG_ID && !isImportSourceTag(tag))
    .sort((a, b) => {
      const colorDiff = tagColorRank(a.color) - tagColorRank(b.color)
      if (colorDiff) return colorDiff
      if (tagColorRank(a.color) === TAG_COLORS.length) {
        const customColorDiff = a.color.localeCompare(b.color)
        if (customColorDiff) return customColorDiff
      }
      const archiveDiff = Number(Boolean(a.archived)) - Number(Boolean(b.archived))
      if (archiveDiff) return archiveDiff
      return (a.sortOrder ?? tags.indexOf(a)) - (b.sortOrder ?? tags.indexOf(b))
    })
}

export function tagDateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

export function cleanupTaskTagIdsAfterDelete(ids: string[] | undefined, deletedId: string) {
  const sourceIds = (ids ?? []).filter(isImportSourceTagId)
  const ordinaryIds = (ids ?? []).filter(tagId => tagId !== deletedId && tagId !== DEFAULT_TAG_ID && !isImportSourceTagId(tagId))
  return ordinaryIds.length ? [ordinaryIds[0], ...sourceIds] : [DEFAULT_TAG_ID, ...sourceIds]
}

export function cleanupJournalTagIdsAfterDelete(ids: string[] | undefined, deletedId: string) {
  const sourceIds = (ids ?? []).filter(isImportSourceTagId)
  const ordinaryIds = (ids ?? []).filter(tagId => tagId !== deletedId && tagId !== DEFAULT_TAG_ID && !isImportSourceTagId(tagId))
  return ordinaryIds.length ? [...ordinaryIds, ...sourceIds] : [DEFAULT_TAG_ID, ...sourceIds]
}
