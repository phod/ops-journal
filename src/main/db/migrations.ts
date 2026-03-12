export const migrations: string[] = [
  // Migration 0 — initial schema
  `
  CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active
    ON investigations(is_active) WHERE is_active = 1;
  `,

  // Migration 1 — add image_path to journal_entries
  `ALTER TABLE journal_entries ADD COLUMN image_path TEXT;`
]
