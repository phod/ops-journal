import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { Investigation } from '@shared/ipc-types'

function getInvestigation(id: string): Investigation {
  const db = getDb()
  return db
    .prepare(
      `SELECT i.*, COUNT(e.id) AS entry_count, MAX(e.created_at) AS last_entry_at
       FROM investigations i
       LEFT JOIN journal_entries e ON e.investigation_id = i.id
       WHERE i.id = ?
       GROUP BY i.id`
    )
    .get(id) as Investigation
}

export function getActiveInvestigations(): Investigation[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM investigations WHERE is_active = 1 ORDER BY created_at ASC')
    .all() as Investigation[]
}

export function listInvestigations(): Investigation[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT i.*, COUNT(e.id) AS entry_count, MAX(e.created_at) AS last_entry_at
       FROM investigations i
       LEFT JOIN journal_entries e ON e.investigation_id = i.id
       GROUP BY i.id
       ORDER BY i.created_at DESC`
    )
    .all() as Investigation[]
}

export function createInvestigation(name: string): Investigation {
  const db = getDb()
  const id = uuidv4()
  db.prepare('INSERT INTO investigations (id, name, is_active) VALUES (?, ?, 0)').run(id, name)
  return getInvestigation(id)
}

export function deleteInvestigation(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM investigations WHERE id = ?').run(id)
}

export function setActiveInvestigation(id: string): Investigation {
  const db = getDb()
  db.prepare('UPDATE investigations SET is_active = 1 WHERE id = ?').run(id)
  return getInvestigation(id)
}

export function renameInvestigation(id: string, name: string): Investigation {
  const db = getDb()
  db.prepare('UPDATE investigations SET name = ? WHERE id = ?').run(name, id)
  return getInvestigation(id)
}

export function deactivateInvestigation(id: string): void {
  const db = getDb()
  db.prepare('UPDATE investigations SET is_active = 0 WHERE id = ?').run(id)
}

export function getSummary(investigationId: string): string | null {
  const db = getDb()
  const row = db
    .prepare('SELECT summary_json FROM investigations WHERE id = ?')
    .get(investigationId) as { summary_json: string | null } | undefined
  return row?.summary_json ?? null
}

export function saveSummary(investigationId: string, summaryJson: string): void {
  const db = getDb()
  db.prepare('UPDATE investigations SET summary_json = ? WHERE id = ?').run(summaryJson, investigationId)
}
