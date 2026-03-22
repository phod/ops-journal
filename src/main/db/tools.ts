import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { Tool, ToolType, FunctionParameter } from '@shared/ipc-types'

function rowToTool(row: Record<string, unknown>): Tool {
  return {
    id: row.id as string,
    name: row.name as string,
    tool_type: row.tool_type as ToolType,
    value: row.value as string,
    tags: JSON.parse((row.tags as string) || '[]'),
    folder_id: (row.folder_id as string) ?? null,
    sort_order: row.sort_order as number,
    parameters: row.parameters ? JSON.parse(row.parameters as string) : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}

export function listTools(): Tool[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM tools ORDER BY sort_order ASC, created_at ASC').all() as Record<string, unknown>[]
  return rows.map(rowToTool)
}

export function createTool(name: string, toolType: ToolType, value: string, tags: string[], folderId?: string | null, parameters?: FunctionParameter[] | null): Tool {
  const db = getDb()
  const id = uuidv4()
  const effectiveFolderId = folderId ?? null
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM tools WHERE folder_id IS ?').get(effectiveFolderId) as Record<string, unknown>)?.m as number | null
  const sortOrder = (maxOrder ?? -1) + 1
  const parametersJson = parameters ? JSON.stringify(parameters) : null
  db.prepare(
    'INSERT INTO tools (id, name, tool_type, value, tags, sort_order, folder_id, parameters) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, toolType, value, JSON.stringify(tags), sortOrder, effectiveFolderId, parametersJson)
  return rowToTool(db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as Record<string, unknown>)
}

export function updateTool(id: string, name: string, toolType: ToolType, value: string, tags: string[], parameters?: FunctionParameter[] | null): Tool {
  const db = getDb()
  const parametersJson = parameters ? JSON.stringify(parameters) : null
  db.prepare(
    "UPDATE tools SET name = ?, tool_type = ?, value = ?, tags = ?, parameters = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, toolType, value, JSON.stringify(tags), parametersJson, id)
  return rowToTool(db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as Record<string, unknown>)
}

export function deleteTool(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM tools WHERE id = ?').run(id)
}

export function createToolsBulk(tools: { name: string; toolType: ToolType; value: string; tags: string[]; parameters?: FunctionParameter[] | null }[], folderId?: string | null): Tool[] {
  if (tools.length === 0) return []
  const db = getDb()
  const created: Tool[] = []
  const effectiveFolderId = folderId ?? null
  const bulkInsert = db.transaction(() => {
    const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM tools WHERE folder_id IS ?').get(effectiveFolderId) as Record<string, unknown>)?.m as number | null
    let sortOrder = (maxOrder ?? -1) + 1
    const stmt = db.prepare(
      'INSERT INTO tools (id, name, tool_type, value, tags, sort_order, folder_id, parameters) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const tool of tools) {
      const id = uuidv4()
      const parametersJson = tool.parameters ? JSON.stringify(tool.parameters) : null
      stmt.run(id, tool.name, tool.toolType, tool.value, JSON.stringify(tool.tags), sortOrder++, effectiveFolderId, parametersJson)
      created.push(rowToTool(db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as Record<string, unknown>))
    }
  })
  bulkInsert()
  return created
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

export function moveToolToFolder(toolId: string, folderId: string | null): void {
  const db = getDb()
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM tools WHERE folder_id IS ?').get(folderId) as Record<string, unknown>)?.m as number | null
  const sortOrder = (maxOrder ?? -1) + 1
  db.prepare("UPDATE tools SET folder_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?").run(folderId, sortOrder, toolId)
}

export function moveToolsToFolder(toolIds: string[], folderId: string | null): void {
  if (toolIds.length === 0) return
  const db = getDb()
  db.transaction(() => {
    const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM tools WHERE folder_id IS ?').get(folderId) as Record<string, unknown>)?.m as number | null
    let sortOrder = (maxOrder ?? -1) + 1
    const stmt = db.prepare("UPDATE tools SET folder_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?")
    for (const id of toolIds) {
      stmt.run(folderId, sortOrder++, id)
    }
  })()
}

export function reorderToolsInFolder(folderId: string | null, orderedIds: string[]): void {
  const db = getDb()
  db.transaction(() => {
    const stmt = db.prepare('UPDATE tools SET sort_order = ? WHERE id = ?')
    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run(i, orderedIds[i])
    }
  })()
}
