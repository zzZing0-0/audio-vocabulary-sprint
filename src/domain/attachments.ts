import type { Attachment, JournalEntry, Task } from '../types'

export type AttachmentLifecycleState = 'active' | 'trash'
export type AttachmentLifecycleRow = { attachment: Attachment; state: AttachmentLifecycleState; activeRefs: number; trashRefs: number }

export function buildAttachmentLifecycle(tasks: Task[], journals: JournalEntry[]): AttachmentLifecycleRow[] {
  const rows = new Map<string, AttachmentLifecycleRow>()
  const add = (items: Attachment[] | undefined, state: AttachmentLifecycleState) => {
    for (const attachment of items ?? []) {
      const current = rows.get(attachment.storageKey) ?? { attachment, state, activeRefs: 0, trashRefs: 0 }
      current.attachment = attachment
      if (state === 'active') current.activeRefs += 1
      else current.trashRefs += 1
      current.state = current.activeRefs > 0 ? 'active' : 'trash'
      rows.set(attachment.storageKey, current)
    }
  }
  for (const task of tasks) {
    const wholeTaskTrashed = Boolean(task.trashedAt)
    add(task.attachments, wholeTaskTrashed ? 'trash' : 'active')
    for (const exception of Object.values(task.recurrenceExceptions ?? {})) {
      if (exception.deleted && !exception.trashedAt) continue
      add(exception.attachments, wholeTaskTrashed || Boolean(exception.trashedAt) ? 'trash' : 'active')
    }
  }
  for (const journal of journals) add(journal.attachments, journal.trashedAt ? 'trash' : 'active')
  return [...rows.values()]
}

export function referencedAttachmentKeys(tasks: Task[], journals: JournalEntry[]): string[] {
  return buildAttachmentLifecycle(tasks, journals).map(row => row.attachment.storageKey)
}
