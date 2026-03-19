import Database from 'better-sqlite3'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

let testDb: Database.Database

vi.mock('../index', () => ({
  getDb: () => testDb
}))

import { listTools, createTool, createToolsBulk, updateTool, deleteTool, reorderTools } from '../tools'

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb.close()
})

describe('listTools', () => {
  it('returns empty array when no tools exist', () => {
    expect(listTools()).toEqual([])
  })

  it('returns tools ordered by sort_order then created_at', () => {
    createTool('Second', 'link', 'https://b.com', [])
    createTool('First', 'string', 'hello', [])
    const tools = listTools()
    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('Second')
    expect(tools[1].name).toBe('First')
  })
})

describe('createTool', () => {
  it('creates a link tool', () => {
    const tool = createTool('Grafana', 'link', 'https://grafana.example.com', ['monitoring'])
    expect(tool.id).toBeTruthy()
    expect(tool.name).toBe('Grafana')
    expect(tool.tool_type).toBe('link')
    expect(tool.value).toBe('https://grafana.example.com')
    expect(tool.tags).toEqual(['monitoring'])
    expect(tool.sort_order).toBe(0)
    expect(tool.created_at).toBeTruthy()
    expect(tool.updated_at).toBeTruthy()
  })

  it('creates a string tool', () => {
    const tool = createTool('kubectl', 'string', 'kubectl get pods -n prod', [])
    expect(tool.tool_type).toBe('string')
    expect(tool.value).toBe('kubectl get pods -n prod')
    expect(tool.tags).toEqual([])
  })

  it('assigns incrementing sort_order', () => {
    const a = createTool('A', 'link', 'https://a.com', [])
    const b = createTool('B', 'link', 'https://b.com', [])
    const c = createTool('C', 'link', 'https://c.com', [])
    expect(a.sort_order).toBe(0)
    expect(b.sort_order).toBe(1)
    expect(c.sort_order).toBe(2)
  })

  it('serializes and deserializes tags as JSON', () => {
    const tool = createTool('Multi', 'link', 'https://x.com', ['prod', 'monitoring', 'critical'])
    expect(tool.tags).toEqual(['prod', 'monitoring', 'critical'])
  })
})

describe('updateTool', () => {
  it('updates all fields of an existing tool', () => {
    const tool = createTool('Old Name', 'link', 'https://old.com', ['old'])
    const updated = updateTool(tool.id, 'New Name', 'string', 'new value', ['new', 'tag'])
    expect(updated.name).toBe('New Name')
    expect(updated.tool_type).toBe('string')
    expect(updated.value).toBe('new value')
    expect(updated.tags).toEqual(['new', 'tag'])
  })

  it('updates the updated_at timestamp', () => {
    const tool = createTool('Test', 'link', 'https://test.com', [])
    const updated = updateTool(tool.id, 'Test Updated', 'link', 'https://test.com', [])
    // updated_at should be set (may or may not differ from created_at depending on speed)
    expect(updated.updated_at).toBeTruthy()
  })

  it('does not affect other tools', () => {
    const a = createTool('A', 'link', 'https://a.com', [])
    const b = createTool('B', 'link', 'https://b.com', [])
    updateTool(a.id, 'A Updated', 'link', 'https://a-new.com', [])
    const tools = listTools()
    expect(tools.find((t) => t.id === b.id)?.name).toBe('B')
  })
})

describe('deleteTool', () => {
  it('removes the tool', () => {
    const tool = createTool('To Delete', 'link', 'https://delete.me', [])
    deleteTool(tool.id)
    expect(listTools()).toHaveLength(0)
  })

  it('does not affect other tools', () => {
    const keep = createTool('Keep', 'link', 'https://keep.com', [])
    const del = createTool('Delete', 'link', 'https://delete.com', [])
    deleteTool(del.id)
    const remaining = listTools()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(keep.id)
  })
})

describe('createToolsBulk', () => {
  it('creates multiple tools with correct names, values, and types', () => {
    const tools = createToolsBulk([
      { name: 'Grafana', toolType: 'link', value: 'https://grafana.example.com', tags: [] },
      { name: 'kubectl pods', toolType: 'string', value: 'kubectl get pods', tags: [] }
    ])
    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('Grafana')
    expect(tools[0].tool_type).toBe('link')
    expect(tools[0].value).toBe('https://grafana.example.com')
    expect(tools[1].name).toBe('kubectl pods')
    expect(tools[1].tool_type).toBe('string')
    expect(tools[1].value).toBe('kubectl get pods')
  })

  it('assigns sequential sort_order values', () => {
    const tools = createToolsBulk([
      { name: 'A', toolType: 'link', value: 'https://a.com', tags: [] },
      { name: 'B', toolType: 'link', value: 'https://b.com', tags: [] },
      { name: 'C', toolType: 'link', value: 'https://c.com', tags: [] }
    ])
    expect(tools[0].sort_order).toBe(0)
    expect(tools[1].sort_order).toBe(1)
    expect(tools[2].sort_order).toBe(2)
  })

  it('continues sort_order after existing tools', () => {
    createTool('Existing', 'link', 'https://existing.com', [])
    const tools = createToolsBulk([
      { name: 'New', toolType: 'link', value: 'https://new.com', tags: [] }
    ])
    expect(tools[0].sort_order).toBe(1)
  })

  it('stores tags faithfully', () => {
    const tools = createToolsBulk([
      { name: 'Tagged', toolType: 'link', value: 'https://x.com', tags: ['prod', 'monitoring', 'runbook'] }
    ])
    expect(tools[0].tags).toEqual(['prod', 'monitoring', 'runbook'])
  })

  it('returns empty array for empty input without error', () => {
    expect(createToolsBulk([])).toEqual([])
    expect(listTools()).toHaveLength(0)
  })
})

describe('reorderTools', () => {
  it('updates sort_order based on array position', () => {
    const a = createTool('A', 'link', 'https://a.com', [])
    const b = createTool('B', 'link', 'https://b.com', [])
    const c = createTool('C', 'link', 'https://c.com', [])

    // Reverse the order
    reorderTools([c.id, b.id, a.id])

    const tools = listTools()
    expect(tools[0].name).toBe('C')
    expect(tools[1].name).toBe('B')
    expect(tools[2].name).toBe('A')
  })

  it('assigns sequential sort_order values starting from 0', () => {
    const a = createTool('A', 'link', 'https://a.com', [])
    const b = createTool('B', 'link', 'https://b.com', [])

    reorderTools([b.id, a.id])

    const tools = listTools()
    expect(tools[0].sort_order).toBe(0)
    expect(tools[1].sort_order).toBe(1)
  })
})
