import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { migrations } from './migrations'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'ops-journal.db')
  db = new Database(dbPath)

  // Performance and correctness pragmas
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run migrations
  runMigrations(db)

  return db
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const getApplied = database.prepare('SELECT id FROM _migrations ORDER BY id')
  const insertMigration = database.prepare('INSERT INTO _migrations (id) VALUES (?)')

  const applied = (getApplied.all() as { id: number }[]).map((r) => r.id)

  for (let i = 0; i < migrations.length; i++) {
    if (!applied.includes(i)) {
      database.exec(migrations[i])
      insertMigration.run(i)
      console.log(`[db] Applied migration ${i}`)
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
