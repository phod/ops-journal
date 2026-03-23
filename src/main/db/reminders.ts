import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { Reminder, ReminderStatus } from '@shared/ipc-types'

function rowToReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    entry_id: row.entry_id as string,
    due_at: row.due_at as string,
    note: (row.note as string) || null,
    status: row.status as ReminderStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    entry_body: row.entry_body as string,
    investigation_id: row.investigation_id as string,
    investigation_name: row.investigation_name as string,
    action_completed: !!(row.action_completed as number),
  }
}

const REMINDER_SELECT = `
  SELECT r.*, je.body as entry_body, je.investigation_id, je.action_completed,
         i.name as investigation_name
  FROM reminders r
  JOIN journal_entries je ON je.id = r.entry_id
  JOIN investigations i ON i.id = je.investigation_id
`

export function createReminder(entryId: string, dueAt: string, note?: string): Reminder {
  const db = getDb()

  // Enforce max one active reminder per entry
  const existing = db
    .prepare(`SELECT id FROM reminders WHERE entry_id = ? AND status = 'active'`)
    .get(entryId) as { id: string } | undefined
  if (existing) {
    throw new Error('Entry already has an active reminder')
  }

  const id = uuidv4()
  db.prepare('INSERT INTO reminders (id, entry_id, due_at, note) VALUES (?, ?, ?, ?)')
    .run(id, entryId, dueAt, note ?? null)

  return getReminder(id)!
}

export function getReminder(id: string): Reminder | undefined {
  const db = getDb()
  const row = db
    .prepare(`${REMINDER_SELECT} WHERE r.id = ?`)
    .get(id) as Record<string, unknown> | undefined
  return row ? rowToReminder(row) : undefined
}

export function getReminderForEntry(entryId: string): Reminder | undefined {
  const db = getDb()
  const row = db
    .prepare(`${REMINDER_SELECT} WHERE r.entry_id = ? AND r.status = 'active'`)
    .get(entryId) as Record<string, unknown> | undefined
  return row ? rowToReminder(row) : undefined
}

export function listReminders(): Reminder[] {
  const db = getDb()
  const rows = db
    .prepare(`${REMINDER_SELECT} ORDER BY r.due_at ASC`)
    .all() as Record<string, unknown>[]
  return rows.map(rowToReminder)
}

export function listOverdueReminders(): Reminder[] {
  const db = getDb()
  const rows = db
    .prepare(`${REMINDER_SELECT} WHERE r.status = 'active' AND datetime(r.due_at) < datetime('now') ORDER BY r.due_at ASC`)
    .all() as Record<string, unknown>[]
  return rows.map(rowToReminder)
}

export function getNextActiveReminder(): Reminder | undefined {
  const db = getDb()
  const row = db
    .prepare(`${REMINDER_SELECT} WHERE r.status = 'active' AND datetime(r.due_at) >= datetime('now') ORDER BY r.due_at ASC LIMIT 1`)
    .get() as Record<string, unknown> | undefined
  return row ? rowToReminder(row) : undefined
}

export function rescheduleReminder(id: string, dueAt: string, note?: string): Reminder {
  const db = getDb()

  // If reactivating a completed/dismissed reminder, check for existing active reminder on the same entry
  const current = db.prepare('SELECT entry_id, status FROM reminders WHERE id = ?').get(id) as { entry_id: string; status: string } | undefined
  if (current && current.status !== 'active') {
    const existing = db
      .prepare(`SELECT id FROM reminders WHERE entry_id = ? AND status = 'active' AND id != ?`)
      .get(current.entry_id, id) as { id: string } | undefined
    if (existing) {
      throw new Error('Entry already has an active reminder')
    }
  }

  if (note !== undefined) {
    db.prepare(`UPDATE reminders SET due_at = ?, note = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`)
      .run(dueAt, note, id)
  } else {
    db.prepare(`UPDATE reminders SET due_at = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`)
      .run(dueAt, id)
  }
  return getReminder(id)!
}

export function completeReminder(id: string): Reminder {
  const db = getDb()
  db.prepare(`UPDATE reminders SET status = 'completed', updated_at = datetime('now') WHERE id = ?`)
    .run(id)
  return getReminder(id)!
}

export function dismissReminder(id: string): void {
  const db = getDb()
  db.prepare(`UPDATE reminders SET status = 'dismissed', updated_at = datetime('now') WHERE id = ?`)
    .run(id)
}

export function deleteReminder(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM reminders WHERE id = ?').run(id)
}
