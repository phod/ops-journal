import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { Investigation } from '@shared/ipc-types'

export function getActiveInvestigations(): Investigation[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM investigations WHERE is_active = 1 ORDER BY created_at ASC')
    .all() as Investigation[]
}

export function listInvestigations(): Investigation[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM investigations ORDER BY created_at DESC')
    .all() as Investigation[]
}

export function createInvestigation(name: string): Investigation {
  const db = getDb()
  const id = uuidv4()
  db.prepare(
    'INSERT INTO investigations (id, name, is_active) VALUES (?, ?, 0)'
  ).run(id, name)
  return db.prepare('SELECT * FROM investigations WHERE id = ?').get(id) as Investigation
}

export function deleteInvestigation(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM investigations WHERE id = ?').run(id)
}

export function setActiveInvestigation(id: string): Investigation {
  const db = getDb()
  db.prepare('UPDATE investigations SET is_active = 1 WHERE id = ?').run(id)
  return db.prepare('SELECT * FROM investigations WHERE id = ?').get(id) as Investigation
}

export function deactivateInvestigation(id: string): void {
  const db = getDb()
  db.prepare('UPDATE investigations SET is_active = 0 WHERE id = ?').run(id)
}
