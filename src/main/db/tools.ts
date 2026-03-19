import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { Tool, ToolType } from '@shared/ipc-types'

function rowToTool(row: Record<string, unknown>): Tool {
  return {
    id: row.id as string,
    name: row.name as string,
    tool_type: row.tool_type as ToolType,
    value: row.value as string,
    tags: JSON.parse((row.tags as string) || '[]'),
    sort_order: row.sort_order as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}

export function listTools(): Tool[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM tools ORDER BY sort_order ASC, created_at ASC').all() as Record<string, unknown>[]
  return rows.map(rowToTool)
}

export function createTool(name: string, toolType: ToolType, value: string, tags: string[]): Tool {
  const db = getDb()
  const id = uuidv4()
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM tools').get() as Record<string, unknown>)?.m as number | null
  const sortOrder = (maxOrder ?? -1) + 1
  db.prepare(
    'INSERT INTO tools (id, name, tool_type, value, tags, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, toolType, value, JSON.stringify(tags), sortOrder)
  return rowToTool(db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as Record<string, unknown>)
}

export function updateTool(id: string, name: string, toolType: ToolType, value: string, tags: string[]): Tool {
  const db = getDb()
  db.prepare(
    "UPDATE tools SET name = ?, tool_type = ?, value = ?, tags = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, toolType, value, JSON.stringify(tags), id)
  return rowToTool(db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as Record<string, unknown>)
}

export function deleteTool(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM tools WHERE id = ?').run(id)
}

export function reorderTools(orderedIds: string[]): void {
  const db = getDb()
  const reorder = db.transaction(() => {
    const stmt = db.prepare('UPDATE tools SET sort_order = ? WHERE id = ?')
    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run(i, orderedIds[i])
    }
  })
  reorder()
}
