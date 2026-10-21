import type { Anniversary, JournalEntry, Tag, Task } from '../types'
import { anniversaryOccurrence } from './calendar'
import { toDateKey } from './task'

export type SearchFilter = 'all' | 'task' | 'journal' | 'anniversary'

export type TagSearchUsage = { tasks: number; journals: number; days: number }

export type SearchResult =
  | { kind: 'task'; id: string; title: string; date: string; snippet: string; item: Task }
  | { kind: 'journal'; id: string; title: string; date: string; snippet: string; item: JournalEntry }
  | { kind: 'anniversary'; id: string; title: string; date: string; snippet: string; item: Anniversary; nextOccurrence?: Date }
  | { kind: 'tag'; id: string; title: string; date: string; snippet: string; item: Tag }

export function normalizeSearchQuery(query: string) {
  return query.trim().toLocaleLowerCase()
}

export function parseTagSearch(normalizedSearch: string) {
  const tagSearchMode = normalizedSearch.startsWith('#')
  return {
    tagSearchMode,
    tagSearchTerm: tagSearchMode ? normalizedSearch.slice(1).trim() : '',
  }
}

export function searchSnippet(text: string, normalizedSearch: string) {
  const clean = text.replace(/[#>*_`~\[\]()!-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const index = clean.toLocaleLowerCase().indexOf(normalizedSearch)
  if (index < 0) return clean.slice(0, 100)
  const from = Math.max(0, index - 22)
  const to = Math.min(clean.length, index + normalizedSearch.length + 34)
  return `${from > 0 ? '…' : ''}${clean.slice(from, to)}${to < clean.length ? '…' : ''}`
}

export function buildSearchResults({
  normalizedSearch,
  searchFilter,
  activeTasks,
  activeJournalEntries,
  activeAnniversaries,
  managedTags,
  tagUsage,
  today,
}: {
  normalizedSearch: string
  searchFilter: SearchFilter
  activeTasks: Task[]
  activeJournalEntries: JournalEntry[]
  activeAnniversaries: Anniversary[]
  managedTags: Tag[]
  tagUsage: Map<string, TagSearchUsage>
  today: Date
}): SearchResult[] {
  if (!normalizedSearch) return []
  const { tagSearchMode, tagSearchTerm } = parseTagSearch(normalizedSearch)
  if (tagSearchMode) {
    return managedTags
      .filter(tag => !tagSearchTerm || tag.name.toLocaleLowerCase().includes(tagSearchTerm))
      .map(tag => {
        const usage = tagUsage.get(tag.id) ?? { tasks: 0, journals: 0, days: 0 }
        return {
          kind: 'tag' as const,
          id: tag.id,
          title: `#${tag.name}`,
          date: '',
          snippet: `任务 ${usage.tasks} · 记录 ${usage.journals} · ${usage.days}天`,
          item: tag,
        }
      })
  }

  const results: SearchResult[] = []
  if (searchFilter === 'all' || searchFilter === 'task') {
    activeTasks.forEach(task => {
      const hay = `${task.title} ${task.notes ?? ''}`.toLocaleLowerCase()
      if (hay.includes(normalizedSearch)) {
        results.push({ kind: 'task', id: task.id, title: task.title, date: task.date ?? '', snippet: searchSnippet(task.notes ?? '', normalizedSearch), item: task })
      }
    })
  }
  if (searchFilter === 'all' || searchFilter === 'journal') {
    activeJournalEntries.forEach(entry => {
      const hay = `${entry.title} ${entry.content}`.toLocaleLowerCase()
      if (hay.includes(normalizedSearch)) {
        results.push({ kind: 'journal', id: entry.id, title: entry.title, date: entry.date, snippet: searchSnippet(entry.content, normalizedSearch), item: entry })
      }
    })
  }
  if (searchFilter === 'all' || searchFilter === 'anniversary') {
    activeAnniversaries.forEach(anniversary => {
      const hay = `${anniversary.title} ${anniversary.notes ?? ''}`.toLocaleLowerCase()
      if (!hay.includes(normalizedSearch)) return
      const candidateYear = Math.max(today.getFullYear(), anniversary.year ?? today.getFullYear())
      let occurrence = anniversaryOccurrence(anniversary, candidateYear)
      if (!occurrence || occurrence < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        occurrence = anniversaryOccurrence(anniversary, candidateYear + 1)
      }
      const sortDate = occurrence
        ? toDateKey(occurrence)
        : anniversary.year
          ? `${anniversary.year}-${String(anniversary.month).padStart(2, '0')}-${String(anniversary.day).padStart(2, '0')}`
          : ''
      results.push({
        kind: 'anniversary',
        id: anniversary.id,
        title: anniversary.title,
        date: sortDate,
        snippet: searchSnippet(anniversary.notes ?? '', normalizedSearch),
        item: anniversary,
        nextOccurrence: occurrence ?? undefined,
      })
    })
  }
  return results.sort((a, b) => b.date.localeCompare(a.date))
}
