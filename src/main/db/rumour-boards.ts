import { v4 as uuidv4 } from 'uuid'
import { getDb } from './index'
import type { RumourBoard, BoardNode, BoardEdge, BoardState, BoardViewport } from '@shared/board-types'

function rowToBoard(row: Record<string, unknown>): RumourBoard {
  return {
    id: row.id as string,
    investigation_id: row.investigation_id as string,
    name: row.name as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}

function rowToNode(row: Record<string, unknown>): BoardNode {
  return {
    id: row.id as string,
    board_id: row.board_id as string,
    node_type: row.node_type as BoardNode['node_type'],
    position_x: row.position_x as number,
    position_y: row.position_y as number,
    width: row.width as number | null,
    height: row.height as number | null,
    z_index: (row.z_index as number) ?? 0,
    data_json: row.data_json as string,
    created_at: row.created_at as string
  }
}

function rowToEdge(row: Record<string, unknown>): BoardEdge {
  return {
    id: row.id as string,
    board_id: row.board_id as string,
    source_node_id: row.source_node_id as string,
    target_node_id: row.target_node_id as string,
    label: row.label as string | null,
    style_json: row.style_json as string | null
  }
}

export function listBoards(investigationId: string): RumourBoard[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM rumour_boards WHERE investigation_id = ? ORDER BY created_at ASC'
  ).all(investigationId) as Record<string, unknown>[]
  return rows.map(rowToBoard)
}

export function createBoard(investigationId: string, name = 'Untitled Board'): RumourBoard {
  const db = getDb()
  const id = uuidv4()
  db.prepare(
    'INSERT INTO rumour_boards (id, investigation_id, name) VALUES (?, ?, ?)'
  ).run(id, investigationId, name)
  return rowToBoard(db.prepare('SELECT * FROM rumour_boards WHERE id = ?').get(id) as Record<string, unknown>)
}

export function deleteBoard(boardId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM rumour_boards WHERE id = ?').run(boardId)
}

export function renameBoard(boardId: string, name: string): RumourBoard {
  const db = getDb()
  db.prepare(
    "UPDATE rumour_boards SET name = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, boardId)
  return rowToBoard(db.prepare('SELECT * FROM rumour_boards WHERE id = ?').get(boardId) as Record<string, unknown>)
}

export function getBoardState(boardId: string): BoardState {
  const db = getDb()
  const rawBoard = db.prepare('SELECT * FROM rumour_boards WHERE id = ?').get(boardId) as Record<string, unknown>
  const board = rowToBoard(rawBoard)
  const nodes = (db.prepare('SELECT * FROM board_nodes WHERE board_id = ?').all(boardId) as Record<string, unknown>[]).map(rowToNode)
  const edges = (db.prepare('SELECT * FROM board_edges WHERE board_id = ?').all(boardId) as Record<string, unknown>[]).map(rowToEdge)
  const viewport: BoardViewport = JSON.parse((rawBoard.viewport_json as string | null) ?? '{"x":0,"y":0,"zoom":1}')
  return { board, nodes, edges, viewport }
}

export function saveBoardState(
  boardId: string,
  state: { nodes: BoardNode[]; edges: BoardEdge[]; viewport: BoardViewport }
): void {
  const db = getDb()
  const { nodes, edges, viewport } = state

  const save = db.transaction(() => {
    db.prepare(
      "UPDATE rumour_boards SET viewport_json = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(viewport), boardId)

    db.prepare('DELETE FROM board_nodes WHERE board_id = ?').run(boardId)
    db.prepare('DELETE FROM board_edges WHERE board_id = ?').run(boardId)

    const insertNode = db.prepare(
      'INSERT INTO board_nodes (id, board_id, node_type, position_x, position_y, width, height, z_index, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const node of nodes) {
      insertNode.run(node.id, boardId, node.node_type, node.position_x, node.position_y, node.width ?? null, node.height ?? null, node.z_index, node.data_json)
    }

    const insertEdge = db.prepare(
      'INSERT INTO board_edges (id, board_id, source_node_id, target_node_id, label, style_json) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const edge of edges) {
      insertEdge.run(edge.id, boardId, edge.source_node_id, edge.target_node_id, edge.label ?? null, edge.style_json ?? null)
    }
  })

  save()
}
