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
  `DROP INDEX IF EXISTS idx_one_active;`,

  // Migration 4 — add type column to journal_entries
  `ALTER TABLE journal_entries ADD COLUMN type TEXT NOT NULL DEFAULT 'note';`,

  // Migration 5 — add hypothesis_status column and hypothesis_findings join table
  `
  ALTER TABLE journal_entries ADD COLUMN hypothesis_status TEXT;

  CREATE TABLE hypothesis_findings (
    hypothesis_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    finding_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    PRIMARY KEY (hypothesis_entry_id, finding_entry_id)
  );
  `,

  // Migration 6 — add summary_json to investigations
  `ALTER TABLE investigations ADD COLUMN summary_json TEXT;`,

  // Migration 7 — rumour boards
  `
  CREATE TABLE IF NOT EXISTS rumour_boards (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Untitled Board',
    viewport_json TEXT NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS board_nodes (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES rumour_boards(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    width REAL,
    height REAL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS board_edges (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES rumour_boards(id) ON DELETE CASCADE,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    label TEXT,
    style_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_board_nodes_board_id ON board_nodes(board_id);
  CREATE INDEX IF NOT EXISTS idx_board_edges_board_id ON board_edges(board_id);
  CREATE INDEX IF NOT EXISTS idx_rumour_boards_investigation_id ON rumour_boards(investigation_id);
  `,

  // Migration 8 — action completion tracking
  `ALTER TABLE journal_entries ADD COLUMN action_completed INTEGER NOT NULL DEFAULT 0;`,

  // Migration 9 — hypothesis-to-hypothesis (parent→child) linking
  `
  CREATE TABLE hypothesis_children (
    parent_hypothesis_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    child_hypothesis_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_hypothesis_id, child_hypothesis_id)
  );
  `,

  // Migration 10 — flagged entries
  `ALTER TABLE journal_entries ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;`,

  // Migration 11 — z-index for board nodes (layer ordering)
  `ALTER TABLE board_nodes ADD COLUMN z_index INTEGER NOT NULL DEFAULT 0;`,

  // Migration 12 — tools (toolkit)
  `
  CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tool_type TEXT NOT NULL CHECK(tool_type IN ('link', 'string')),
    value TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tools_sort_order ON tools(sort_order);
  `,

  // Migration 13 — tool entry status tracking
  `ALTER TABLE journal_entries ADD COLUMN tool_status TEXT;`,

  // Migration 14 — tool folders + folder_id on tools
  `
  CREATE TABLE IF NOT EXISTS tool_folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES tool_folders(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tool_folders_parent_id ON tool_folders(parent_id);
  CREATE INDEX IF NOT EXISTS idx_tool_folders_sort_order ON tool_folders(sort_order);

  ALTER TABLE tools ADD COLUMN folder_id TEXT REFERENCES tool_folders(id) ON DELETE SET NULL;
  `,
]
