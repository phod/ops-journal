import Database from 'better-sqlite3'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

let testDb: Database.Database

vi.mock('../index', () => ({
  getDb: () => testDb
}))

import { createInvestigation } from '../investigations'
import { listBoards, createBoard, deleteBoard, renameBoard, getBoardState, saveBoardState } from '../rumour-boards'
import type { BoardNode, BoardEdge, BoardViewport } from '@shared/board-types'

let investigationId: string

beforeEach(() => {
  testDb = createTestDb()
  investigationId = createInvestigation('Test Investigation').id
})

afterEach(() => {
  testDb.close()
})

describe('listBoards', () => {
  it('returns empty array when no boards exist', () => {
    expect(listBoards(investigationId)).toEqual([])
  })

  it('returns boards ordered by created_at ASC', () => {
    createBoard(investigationId, 'First')
    createBoard(investigationId, 'Second')
    const boards = listBoards(investigationId)
    expect(boards).toHaveLength(2)
    expect(boards[0].name).toBe('First')
    expect(boards[1].name).toBe('Second')
  })

  it('does not return boards from other investigations', () => {
    const otherId = createInvestigation('Other').id
    createBoard(investigationId, 'Mine')
    createBoard(otherId, 'Theirs')
    expect(listBoards(investigationId)).toHaveLength(1)
    expect(listBoards(investigationId)[0].name).toBe('Mine')
  })
})

describe('createBoard', () => {
  it('creates a board with default name', () => {
    const board = createBoard(investigationId)
    expect(board.name).toBe('Untitled Board')
    expect(board.id).toBeTruthy()
    expect(board.investigation_id).toBe(investigationId)
    expect(board.created_at).toBeTruthy()
  })

  it('creates a board with a custom name', () => {
    const board = createBoard(investigationId, 'My Board')
    expect(board.name).toBe('My Board')
  })
})

describe('deleteBoard', () => {
  it('removes the board', () => {
    const board = createBoard(investigationId, 'To Delete')
    deleteBoard(board.id)
    expect(listBoards(investigationId)).toHaveLength(0)
  })

  it('does not affect other boards', () => {
    const keep = createBoard(investigationId, 'Keep')
    const del = createBoard(investigationId, 'Delete')
    deleteBoard(del.id)
    const remaining = listBoards(investigationId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(keep.id)
  })
})

describe('renameBoard', () => {
  it('updates the board name', () => {
    const board = createBoard(investigationId, 'Old Name')
    const renamed = renameBoard(board.id, 'New Name')
    expect(renamed.name).toBe('New Name')
    expect(renamed.id).toBe(board.id)
  })

  it('updates the updated_at timestamp', () => {
    // Insert a board with an old timestamp to ensure rename changes it
    testDb.prepare(
      "INSERT INTO rumour_boards (id, investigation_id, name, created_at, updated_at) VALUES ('old-board', ?, 'Old', '2024-01-01 00:00:00', '2024-01-01 00:00:00')"
    ).run(investigationId)
    const renamed = renameBoard('old-board', 'Renamed')
    expect(renamed.updated_at).not.toBe('2024-01-01 00:00:00')
  })
})

describe('getBoardState', () => {
  it('returns board with empty nodes and edges', () => {
    const board = createBoard(investigationId, 'Empty Board')
    const state = getBoardState(board.id)
    expect(state.board.id).toBe(board.id)
    expect(state.nodes).toEqual([])
    expect(state.edges).toEqual([])
    expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('returns saved nodes and edges', () => {
    const board = createBoard(investigationId)
    const nodes: BoardNode[] = [
      { id: 'n1', board_id: board.id, node_type: 'textbox', position_x: 10, position_y: 20, width: 200, height: 100, z_index: 0, data_json: '{"text":"hello"}', created_at: '' }
    ]
    const edges: BoardEdge[] = []
    const viewport: BoardViewport = { x: 5, y: 10, zoom: 1.5 }
    saveBoardState(board.id, { nodes, edges, viewport })

    const state = getBoardState(board.id)
    expect(state.nodes).toHaveLength(1)
    expect(state.nodes[0].id).toBe('n1')
    expect(state.nodes[0].node_type).toBe('textbox')
    expect(state.nodes[0].position_x).toBe(10)
    expect(state.viewport).toEqual(viewport)
  })
})

describe('saveBoardState', () => {
  it('saves and replaces nodes on subsequent calls', () => {
    const board = createBoard(investigationId)
    const viewport: BoardViewport = { x: 0, y: 0, zoom: 1 }

    saveBoardState(board.id, {
      nodes: [
        { id: 'n1', board_id: board.id, node_type: 'textbox', position_x: 0, position_y: 0, width: 100, height: 50, z_index: 0, data_json: '{}', created_at: '' }
      ],
      edges: [],
      viewport
    })
    expect(getBoardState(board.id).nodes).toHaveLength(1)

    saveBoardState(board.id, {
      nodes: [
        { id: 'n2', board_id: board.id, node_type: 'entry', position_x: 50, position_y: 50, width: 200, height: 70, z_index: 1, data_json: '{"entryId":"e1"}', created_at: '' },
        { id: 'n3', board_id: board.id, node_type: 'image', position_x: 100, position_y: 100, width: 150, height: 150, z_index: 2, data_json: '{"imagePath":"/img.png"}', created_at: '' }
      ],
      edges: [],
      viewport
    })

    const state = getBoardState(board.id)
    expect(state.nodes).toHaveLength(2)
    expect(state.nodes.find((n) => n.id === 'n1')).toBeUndefined()
  })

  it('saves edges with labels', () => {
    const board = createBoard(investigationId)
    const nodes: BoardNode[] = [
      { id: 'n1', board_id: board.id, node_type: 'textbox', position_x: 0, position_y: 0, width: 100, height: 50, z_index: 0, data_json: '{}', created_at: '' },
      { id: 'n2', board_id: board.id, node_type: 'textbox', position_x: 200, position_y: 0, width: 100, height: 50, z_index: 0, data_json: '{}', created_at: '' }
    ]
    const edges: BoardEdge[] = [
      { id: 'e1', board_id: board.id, source_node_id: 'n1', target_node_id: 'n2', label: 'causes', style_json: null }
    ]
    saveBoardState(board.id, { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } })

    const state = getBoardState(board.id)
    expect(state.edges).toHaveLength(1)
    expect(state.edges[0].source_node_id).toBe('n1')
    expect(state.edges[0].target_node_id).toBe('n2')
    expect(state.edges[0].label).toBe('causes')
  })

  it('persists viewport state', () => {
    const board = createBoard(investigationId)
    const viewport: BoardViewport = { x: -100, y: 200, zoom: 2.5 }
    saveBoardState(board.id, { nodes: [], edges: [], viewport })

    const state = getBoardState(board.id)
    expect(state.viewport).toEqual(viewport)
  })
})
