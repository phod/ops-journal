import Database from 'better-sqlite3'
import { migrations } from '../migrations'

export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const sql of migrations) {
    db.exec(sql)
  }
  return db
}
