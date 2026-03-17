import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { JournalEntry, EntryType, HypothesisStatus } from '@shared/ipc-types'
import { MAX_HYPOTHESIS_NESTING_DEPTH } from '@shared/ipc-types'

const ENTRY_COLUMNS = `
  je.id, je.investigation_id, je.body, je.created_at, je.type, je.hypothesis_status, je.action_completed, je.flagged,
  json_group_array(ei.image_path) FILTER (WHERE ei.image_path IS NOT NULL) as image_paths_json,
  (SELECT json_group_array(hf.finding_entry_id) FROM hypothesis_findings hf WHERE hf.hypothesis_entry_id = je.id) as linked_finding_ids_json,
  (SELECT json_group_array(hc.child_hypothesis_id) FROM hypothesis_children hc WHERE hc.parent_hypothesis_id = je.id) as linked_child_hypothesis_ids_json,
  (SELECT json_group_array(hc.parent_hypothesis_id) FROM hypothesis_children hc WHERE hc.child_hypothesis_id = je.id) as parent_hypothesis_ids_json
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
  const type = (row.type as EntryType) ?? 'note'
  const entry: JournalEntry = {
    id: row.id as string,
    investigation_id: row.investigation_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    type,
    image_paths: JSON.parse((row.image_paths_json as string) || '[]')
  }
  if (row.hypothesis_status != null) {
    entry.hypothesis_status = row.hypothesis_status as HypothesisStatus
  }
  if (type === 'action') {
    entry.action_completed = (row.action_completed as number) === 1
  }
  entry.flagged = (row.flagged as number) === 1
  if (type === 'hypothesis') {
    entry.linked_finding_ids = JSON.parse((row.linked_finding_ids_json as string) || '[]')
    entry.linked_child_hypothesis_ids = JSON.parse((row.linked_child_hypothesis_ids_json as string) || '[]')
    const parentIds = JSON.parse((row.parent_hypothesis_ids_json as string) || '[]')
    if (parentIds.length > 0) {
      entry.parent_hypothesis_ids = parentIds
    }
  }
  return entry
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
  if (type === 'hypothesis') {
    db.prepare('INSERT INTO journal_entries (id, investigation_id, body, type, hypothesis_status) VALUES (?, ?, ?, ?, ?)').run(id, investigationId, body, type, 'open')
  } else {
    db.prepare('INSERT INTO journal_entries (id, investigation_id, body, type) VALUES (?, ?, ?, ?)').run(id, investigationId, body, type)
  }
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
    if (type === 'hypothesis') {
      db.prepare("UPDATE journal_entries SET hypothesis_status = 'open' WHERE id = ? AND hypothesis_status IS NULL").run(id)
    }
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

export function toggleActionCompleted(id: string): JournalEntry {
  const db = getDb()
  db.prepare('UPDATE journal_entries SET action_completed = CASE WHEN action_completed = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id)
  return getEntry(id)!
}

export function toggleFlagged(id: string): JournalEntry {
  const db = getDb()
  db.prepare('UPDATE journal_entries SET flagged = CASE WHEN flagged = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id)
  return getEntry(id)!
}

export function updateHypothesisStatus(id: string, status: HypothesisStatus): JournalEntry {
  const db = getDb()
  db.prepare('UPDATE journal_entries SET hypothesis_status = ? WHERE id = ?').run(status, id)
  return getEntry(id)!
}

export function linkHypothesisFinding(hypothesisId: string, findingId: string): JournalEntry {
  const db = getDb()
  db.prepare('INSERT OR IGNORE INTO hypothesis_findings (hypothesis_entry_id, finding_entry_id) VALUES (?, ?)').run(hypothesisId, findingId)
  return getEntry(hypothesisId)!
}

export function unlinkHypothesisFinding(hypothesisId: string, findingId: string): JournalEntry {
  const db = getDb()
  db.prepare('DELETE FROM hypothesis_findings WHERE hypothesis_entry_id = ? AND finding_entry_id = ?').run(hypothesisId, findingId)
  return getEntry(hypothesisId)!
}

export function getHypothesisFindings(hypothesisId: string): JournalEntry[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT ${ENTRY_COLUMNS}
    FROM journal_entries je
    LEFT JOIN entry_images ei ON ei.entry_id = je.id
    WHERE je.id IN (SELECT finding_entry_id FROM hypothesis_findings WHERE hypothesis_entry_id = ?)
    GROUP BY je.id
  `).all(hypothesisId) as Record<string, unknown>[]
  return rows.map(rowToEntry)
}

export function getFindingHypotheses(findingId: string): JournalEntry[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT ${ENTRY_COLUMNS}
    FROM journal_entries je
    LEFT JOIN entry_images ei ON ei.entry_id = je.id
    WHERE je.id IN (SELECT hypothesis_entry_id FROM hypothesis_findings WHERE finding_entry_id = ?)
    GROUP BY je.id
  `).all(findingId) as Record<string, unknown>[]
  return rows.map(rowToEntry)
}

/**
 * Compute how many levels of ancestors a hypothesis has (0 = root).
 */
function depthToRoot(db: ReturnType<typeof getDb>, hypothesisId: string): number {
  let depth = 0
  let currentId = hypothesisId
  const visited = new Set<string>()
  while (true) {
    visited.add(currentId)
    const row = db.prepare('SELECT parent_hypothesis_id FROM hypothesis_children WHERE child_hypothesis_id = ? LIMIT 1').get(currentId) as { parent_hypothesis_id: string } | undefined
    if (!row || visited.has(row.parent_hypothesis_id)) break
    depth++
    currentId = row.parent_hypothesis_id
  }
  return depth
}

/**
 * Compute the max depth from a hypothesis down to its deepest descendant (0 = leaf).
 */
function depthToLeaf(db: ReturnType<typeof getDb>, hypothesisId: string): number {
  const children = db.prepare('SELECT child_hypothesis_id FROM hypothesis_children WHERE parent_hypothesis_id = ?').all(hypothesisId) as { child_hypothesis_id: string }[]
  if (children.length === 0) return 0
  let max = 0
  for (const child of children) {
    max = Math.max(max, 1 + depthToLeaf(db, child.child_hypothesis_id))
  }
  return max
}

/**
 * Check if `ancestorId` is an ancestor of `hypothesisId` (or is the same id).
 */
function isAncestor(db: ReturnType<typeof getDb>, hypothesisId: string, ancestorId: string): boolean {
  if (hypothesisId === ancestorId) return true
  const visited = new Set<string>()
  let currentId = hypothesisId
  while (true) {
    visited.add(currentId)
    const row = db.prepare('SELECT parent_hypothesis_id FROM hypothesis_children WHERE child_hypothesis_id = ? LIMIT 1').get(currentId) as { parent_hypothesis_id: string } | undefined
    if (!row || visited.has(row.parent_hypothesis_id)) break
    if (row.parent_hypothesis_id === ancestorId) return true
    currentId = row.parent_hypothesis_id
  }
  return false
}

export function linkHypothesisChild(parentId: string, childId: string): JournalEntry {
  const db = getDb()
  // Prevent self-linking
  if (parentId === childId) throw new Error('Cannot link a hypothesis to itself')
  // Prevent cycles: child must not be an ancestor of parent
  if (isAncestor(db, parentId, childId)) throw new Error('Cannot create circular hypothesis chain')
  // Check depth limit: depth from root to parent + 1 + depth from child to leaf <= MAX
  const totalDepth = depthToRoot(db, parentId) + 1 + depthToLeaf(db, childId)
  if (totalDepth >= MAX_HYPOTHESIS_NESTING_DEPTH) throw new Error(`Nesting depth would exceed maximum of ${MAX_HYPOTHESIS_NESTING_DEPTH}`)
  db.prepare('INSERT OR IGNORE INTO hypothesis_children (parent_hypothesis_id, child_hypothesis_id) VALUES (?, ?)').run(parentId, childId)
  return getEntry(parentId)!
}

export function unlinkHypothesisChild(parentId: string, childId: string): JournalEntry {
  const db = getDb()
  db.prepare('DELETE FROM hypothesis_children WHERE parent_hypothesis_id = ? AND child_hypothesis_id = ?').run(parentId, childId)
  return getEntry(parentId)!
}

export function getHypothesisNestingDepth(hypothesisId: string): number {
  const db = getDb()
  return depthToRoot(db, hypothesisId)
}
