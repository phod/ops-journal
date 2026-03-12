import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { JournalEntry } from '@shared/ipc-types'

export function listEntries(investigationId: string): JournalEntry[] {
  const db = getDb()
  return db
    .prepare(
      'SELECT * FROM journal_entries WHERE investigation_id = ? ORDER BY created_at ASC'
    )
    .all(investigationId) as JournalEntry[]
}

export function updateEntry(id: string, body: string): JournalEntry {
  const db = getDb()
  db.prepare('UPDATE journal_entries SET body = ? WHERE id = ?').run(body, id)
  return db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id) as JournalEntry
}

export function deleteEntry(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id)
}

export function createEntry(investigationId: string, body: string): JournalEntry {
  const db = getDb()
  const id = uuidv4()
  db.prepare(
    'INSERT INTO journal_entries (id, investigation_id, body) VALUES (?, ?, ?)'
  ).run(id, investigationId, body)
  return db
    .prepare('SELECT * FROM journal_entries WHERE id = ?')
    .get(id) as JournalEntry
}
