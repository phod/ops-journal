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
  `ALTER TABLE journal_entries ADD COLUMN image_path TEXT;`,

  // Migration 2 — multi-image support via entry_images table
  `
  CREATE TABLE IF NOT EXISTS entry_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  INSERT INTO entry_images (entry_id, image_path, sort_order)
    SELECT id, image_path, 0 FROM journal_entries WHERE image_path IS NOT NULL;
  `,

  // Migration 3 — allow multiple active investigations
  `DROP INDEX IF EXISTS idx_one_active;`
]
