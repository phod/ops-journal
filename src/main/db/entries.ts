import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { JournalEntry, EntryType } from '@shared/ipc-types'

const ENTRY_COLUMNS = `
  je.id, je.investigation_id, je.body, je.created_at, je.type,
  json_group_array(ei.image_path) FILTER (WHERE ei.image_path IS NOT NULL) as image_paths_json
`

const SELECT_ENTRY = `
  SELECT ${ENTRY_COLUMNS}
  FROM journal_entries je
  LEFT JOIN entry_images ei ON ei.entry_id = je.id
  WHERE je.id = ?
  GROUP BY je.id
`

const SELECT_ENTRIES_FOR_INVESTIGATION = `
  SELECT ${ENTRY_COLUMNS}
  FROM journal_entries je
  LEFT JOIN entry_images ei ON ei.entry_id = je.id
  WHERE je.investigation_id = ?
  GROUP BY je.id
  ORDER BY je.created_at ASC, je.rowid ASC
`

function rowToEntry(row: Record<string, unknown>): JournalEntry {
  return {
    id: row.id as string,
    investigation_id: row.investigation_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    type: (row.type as EntryType) ?? 'note',
    image_paths: JSON.parse((row.image_paths_json as string) || '[]')
  }
}

export function listEntries(investigationId: string): JournalEntry[] {
  const db = getDb()
  const rows = db.prepare(SELECT_ENTRIES_FOR_INVESTIGATION).all(investigationId) as Record<string, unknown>[]
  return rows.map(rowToEntry)
}

export function getEntry(id: string): JournalEntry | undefined {
  const db = getDb()
  const row = db.prepare(SELECT_ENTRY).get(id) as Record<string, unknown> | undefined
  return row ? rowToEntry(row) : undefined
}

export function createEntry(investigationId: string, body: string, imagePaths?: string[], type: EntryType = 'note'): JournalEntry {
  const db = getDb()
  const id = uuidv4()
  db.prepare('INSERT INTO journal_entries (id, investigation_id, body, type) VALUES (?, ?, ?, ?)').run(id, investigationId, body, type)
  if (imagePaths && imagePaths.length > 0) {
    const insertImage = db.prepare('INSERT INTO entry_images (entry_id, image_path, sort_order) VALUES (?, ?, ?)')
    for (let i = 0; i < imagePaths.length; i++) {
      insertImage.run(id, imagePaths[i], i)
    }
  }
  return getEntry(id)!
}

export function updateEntry(id: string, body: string, keepImagePaths?: string[] | null, type?: EntryType): JournalEntry {
  const db = getDb()
  if (type !== undefined) {
    db.prepare('UPDATE journal_entries SET body = ?, type = ? WHERE id = ?').run(body, type, id)
  } else {
    db.prepare('UPDATE journal_entries SET body = ? WHERE id = ?').run(body, id)
  }

  if (keepImagePaths === null || (Array.isArray(keepImagePaths) && keepImagePaths.length === 0)) {
    db.prepare('DELETE FROM entry_images WHERE entry_id = ?').run(id)
  } else if (keepImagePaths !== undefined) {
    const deleteImage = db.prepare('DELETE FROM entry_images WHERE entry_id = ? AND image_path = ?')
    const existing = db.prepare('SELECT image_path FROM entry_images WHERE entry_id = ?').all(id) as { image_path: string }[]
    for (const { image_path } of existing) {
      if (!keepImagePaths.includes(image_path)) {
        deleteImage.run(id, image_path)
      }
    }
  }

  return getEntry(id)!
}

export function deleteEntry(id: string): JournalEntry | undefined {
  const db = getDb()
  const entry = getEntry(id)
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id)
  return entry
}
