import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { Investigation } from '@shared/ipc-types'

export function getActiveInvestigation(): Investigation | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM investigations WHERE is_active = 1 LIMIT 1')
    .get() as Investigation | undefined
  return row ?? null
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

  const setActive = db.transaction(() => {
    // Clear any currently active investigation
    db.prepare('UPDATE investigations SET is_active = 0 WHERE is_active = 1').run()
    // Set the new active
    db.prepare('UPDATE investigations SET is_active = 1 WHERE id = ?').run(id)
  })

  setActive()

  return db.prepare('SELECT * FROM investigations WHERE id = ?').get(id) as Investigation
}
