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

export function getEntry(id: string): JournalEntry | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id) as JournalEntry | undefined
}

export function createEntry(investigationId: string, body: string, imagePath?: string): JournalEntry {
  const db = getDb()
  const id = uuidv4()
  db.prepare(
    'INSERT INTO journal_entries (id, investigation_id, body, image_path) VALUES (?, ?, ?, ?)'
  ).run(id, investigationId, body, imagePath ?? null)
  return db
    .prepare('SELECT * FROM journal_entries WHERE id = ?')
    .get(id) as JournalEntry
}

export function updateEntry(id: string, body: string, imagePath?: string | null): JournalEntry {
  const db = getDb()
  if (imagePath === undefined) {
    // Don't touch image_path
    db.prepare('UPDATE journal_entries SET body = ? WHERE id = ?').run(body, id)
  } else {
    db.prepare('UPDATE journal_entries SET body = ?, image_path = ? WHERE id = ?').run(body, imagePath, id)
  }
  return db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id) as JournalEntry
}

export function deleteEntry(id: string): JournalEntry | undefined {
  const db = getDb()
  const entry = getEntry(id)
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id)
  return entry
}
