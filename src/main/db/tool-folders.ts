import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { ToolFolder } from '@shared/ipc-types'
import { MAX_TOOL_FOLDER_DEPTH } from '@shared/ipc-types'

function rowToFolder(row: Record<string, unknown>): ToolFolder {
  return {
    id: row.id as string,
    name: row.name as string,
    parent_id: (row.parent_id as string) ?? null,
    sort_order: row.sort_order as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}

export function listToolFolders(): ToolFolder[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM tool_folders ORDER BY sort_order ASC, created_at ASC').all() as Record<string, unknown>[]
  return rows.map(rowToFolder)
}

function folderDepthToRoot(db: ReturnType<typeof getDb>, folderId: string): number {
  let depth = 0
  let currentId: string | null = folderId
  const visited = new Set<string>()
  while (currentId) {
    visited.add(currentId)
    const row = db.prepare('SELECT parent_id FROM tool_folders WHERE id = ?').get(currentId) as { parent_id: string | null } | undefined
    if (!row || !row.parent_id || visited.has(row.parent_id)) break
    depth++
    currentId = row.parent_id
  }
  return depth
}

function folderDepthToLeaf(db: ReturnType<typeof getDb>, folderId: string): number {
  const children = db.prepare('SELECT id FROM tool_folders WHERE parent_id = ?').all(folderId) as { id: string }[]
  if (children.length === 0) return 0
  let max = 0
  for (const child of children) {
    max = Math.max(max, 1 + folderDepthToLeaf(db, child.id))
  }
  return max
}

function isFolderAncestor(db: ReturnType<typeof getDb>, folderId: string, potentialAncestorId: string): boolean {
  if (folderId === potentialAncestorId) return true
  const visited = new Set<string>()
  let currentId: string | null = folderId
  while (currentId) {
    visited.add(currentId)
    const row = db.prepare('SELECT parent_id FROM tool_folders WHERE id = ?').get(currentId) as { parent_id: string | null } | undefined
    if (!row || !row.parent_id || visited.has(row.parent_id)) break
    if (row.parent_id === potentialAncestorId) return true
    currentId = row.parent_id
  }
  return false
}

export function createToolFolder(name: string, parentId?: string | null): ToolFolder {
  const db = getDb()
  const id = uuidv4()

  if (parentId) {
    const parentDepth = folderDepthToRoot(db, parentId)
    if (parentDepth + 1 >= MAX_TOOL_FOLDER_DEPTH) {
      throw new Error(`Cannot create folder: maximum nesting depth of ${MAX_TOOL_FOLDER_DEPTH} would be exceeded`)
    }
  }

  const maxOrder = (db.prepare(
    'SELECT MAX(sort_order) as m FROM tool_folders WHERE parent_id IS ?'
  ).get(parentId ?? null) as Record<string, unknown>)?.m as number | null
  const sortOrder = (maxOrder ?? -1) + 1

  db.prepare(
    'INSERT INTO tool_folders (id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)'
  ).run(id, name, parentId ?? null, sortOrder)

  return rowToFolder(db.prepare('SELECT * FROM tool_folders WHERE id = ?').get(id) as Record<string, unknown>)
}

export function renameToolFolder(id: string, name: string): ToolFolder {
  const db = getDb()
  db.prepare("UPDATE tool_folders SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id)
  return rowToFolder(db.prepare('SELECT * FROM tool_folders WHERE id = ?').get(id) as Record<string, unknown>)
}

export function deleteToolFolder(id: string): void {
  const db = getDb()
  const folder = db.prepare('SELECT parent_id FROM tool_folders WHERE id = ?').get(id) as { parent_id: string | null } | undefined
  if (!folder) return

  const parentId = folder.parent_id

  db.transaction(() => {
    // Move child folders to deleted folder's parent
    db.prepare('UPDATE tool_folders SET parent_id = ? WHERE parent_id = ?').run(parentId, id)
    // Move tools to deleted folder's parent
    db.prepare('UPDATE tools SET folder_id = ? WHERE folder_id = ?').run(parentId, id)
    // Delete the folder
    db.prepare('DELETE FROM tool_folders WHERE id = ?').run(id)
  })()
}

export function moveToolFolderToFolder(folderId: string, parentId: string | null): void {
  const db = getDb()

  if (parentId) {
    // Prevent moving into self or descendant
    if (isFolderAncestor(db, parentId, folderId)) {
      throw new Error('Cannot move folder into itself or a descendant')
    }
    // Depth validation
    const parentDepthToRoot = folderDepthToRoot(db, parentId)
    const thisDepthToLeaf = folderDepthToLeaf(db, folderId)
    if (parentDepthToRoot + 1 + thisDepthToLeaf >= MAX_TOOL_FOLDER_DEPTH) {
      throw new Error(`Cannot move folder: maximum nesting depth of ${MAX_TOOL_FOLDER_DEPTH} would be exceeded`)
    }
  }

  // Append to end of new parent's children
  const maxOrder = (db.prepare(
    'SELECT MAX(sort_order) as m FROM tool_folders WHERE parent_id IS ?'
  ).get(parentId) as Record<string, unknown>)?.m as number | null
  const sortOrder = (maxOrder ?? -1) + 1

  db.prepare("UPDATE tool_folders SET parent_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?").run(parentId, sortOrder, folderId)
}

export function reorderToolFoldersInParent(parentId: string | null, orderedIds: string[]): void {
  const db = getDb()
  db.transaction(() => {
    const stmt = db.prepare('UPDATE tool_folders SET sort_order = ? WHERE id = ?')
    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run(i, orderedIds[i])
    }
  })()
}
