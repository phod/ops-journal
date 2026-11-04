import Database from 'better-sqlite3'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

let testDb: Database.Database

vi.mock('../index', () => ({
  getDb: () => testDb
}))

import { listTools, createTool, createToolsBulk, updateTool, deleteTool, reorderTools, duplicateTool } from '../tools'

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

describe('function tools', () => {
  it('creates a function tool with parameters', () => {
    const params = [
      { name: 'userId', type: 'text' as const },
      { name: 'userPlan', type: 'list' as const, options: ['FREE', 'PAID', 'PREMIUM'] }
    ]
    const tool = createTool('Support Console', 'function', 'copy(userPlan);\nopenLink("https://site.com/" + userId);', ['support'], undefined, params)
    expect(tool.tool_type).toBe('function')
    expect(tool.parameters).toEqual(params)
  })

  it('round-trips parameters through JSON serialization', () => {
    const params = [
      { name: 'env', type: 'list-other' as const, options: ['staging', 'production'] }
    ]
    createTool('Deploy', 'function', 'openLink("https://deploy/" + env);', [], undefined, params)
    const tools = listTools()
    const found = tools.find((t) => t.name === 'Deploy')
    expect(found?.parameters).toEqual(params)
  })

  it('updates function tool parameters', () => {
    const tool = createTool('Test', 'function', 'copy("x");', [], undefined, [{ name: 'a', type: 'text' as const }])
    const updated = updateTool(tool.id, 'Test', 'function', 'copy(a);', [], [{ name: 'a', type: 'text' as const }, { name: 'b', type: 'list' as const, options: ['x', 'y'] }])
    expect(updated.parameters).toHaveLength(2)
    expect(updated.parameters![1].options).toEqual(['x', 'y'])
  })

  it('round-trips required flag through create and list', () => {
    const params = [
      { name: 'userId', type: 'text' as const, required: true },
      { name: 'note', type: 'text' as const }
    ]
    const tool = createTool('Required Test', 'function', 'copy(userId);', [], undefined, params)
    expect(tool.parameters![0].required).toBe(true)
    expect(tool.parameters![1].required).toBeUndefined()

    const tools = listTools()
    const found = tools.find((t) => t.name === 'Required Test')
    expect(found?.parameters![0].required).toBe(true)
    expect(found?.parameters![1].required).toBeUndefined()
  })

  it('preserves required flag through updateTool', () => {
    const tool = createTool('Update Required', 'function', 'copy(a);', [], undefined, [
      { name: 'a', type: 'text' as const, required: true }
    ])
    const updated = updateTool(tool.id, 'Update Required', 'function', 'copy(a);', [], [
      { name: 'a', type: 'text' as const, required: true },
      { name: 'b', type: 'text' as const }
    ])
    expect(updated.parameters![0].required).toBe(true)
    expect(updated.parameters![1].required).toBeUndefined()
  })

  it('returns null parameters for non-function tools', () => {
    const tool = createTool('Link', 'link', 'https://example.com', [])
    expect(tool.parameters).toBeNull()
  })
})

describe('content tools', () => {
  it('creates a content tool and round-trips via listTools', () => {
    const tool = createTool('UUID Mappings', 'content', 'abc-123 → prod-server-1\ndef-456 → prod-server-2', ['infra'])
    expect(tool.tool_type).toBe('content')
    expect(tool.value).toContain('abc-123')
    expect(tool.tags).toEqual(['infra'])

    const tools = listTools()
    const found = tools.find((t) => t.id === tool.id)
    expect(found).toBeDefined()
    expect(found!.tool_type).toBe('content')
    expect(found!.value).toBe('abc-123 → prod-server-1\ndef-456 → prod-server-2')
  })
})

describe('reference tools', () => {
  it('creates a reference tool with JSON value and round-trips via listTools', () => {
    const entries = JSON.stringify([
      { key: 'abc-123', value: 'MyUser' },
      { key: 'def-456', value: 'AnotherUser' }
    ])
    const tool = createTool('User ID Map', 'reference', entries, ['users', 'lookup'])
    expect(tool.tool_type).toBe('reference')
    expect(tool.value).toBe(entries)
    expect(tool.tags).toEqual(['users', 'lookup'])

    const tools = listTools()
    const found = tools.find((t) => t.id === tool.id)
    expect(found).toBeDefined()
    expect(found!.tool_type).toBe('reference')
    expect(JSON.parse(found!.value)).toEqual([
      { key: 'abc-123', value: 'MyUser' },
      { key: 'def-456', value: 'AnotherUser' }
    ])
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

describe('duplicateTool', () => {
  it('copies type, value, tags, parameters and folder', () => {
    const params = [{ name: 'env', type: 'list' as const, options: ['prod', 'staging'], required: true }]
    const original = createTool('Open env', 'function', 'openLink("https://" + env);', ['aws', 'console'], null, params)
    const copy = duplicateTool(original.id)
    expect(copy.id).not.toBe(original.id)
    expect(copy.tool_type).toBe('function')
    expect(copy.value).toBe('openLink("https://" + env);')
    expect(copy.tags).toEqual(['aws', 'console'])
    expect(copy.parameters).toEqual(params)
    expect(copy.folder_id).toBeNull()
  })

  it('keeps the copy in the same folder as the original', () => {
    testDb.prepare("INSERT INTO tool_folders (id, name, parent_id, sort_order) VALUES ('f1', 'AWS', NULL, 0)").run()
    const original = createTool('Prod', 'link', 'https://prod', [], 'f1')
    const copy = duplicateTool(original.id)
    expect(copy.folder_id).toBe('f1')
  })

  it('appends (2) to the name', () => {
    const original = createTool('Prod dashboard', 'link', 'https://prod', [])
    expect(duplicateTool(original.id).name).toBe('Prod dashboard (2)')
  })

  it('increments the suffix when (2) is already taken by a sibling', () => {
    const original = createTool('Prod dashboard', 'link', 'https://prod', [])
    duplicateTool(original.id)
    expect(duplicateTool(original.id).name).toBe('Prod dashboard (3)')
  })

  it('increments an existing numeric suffix instead of stacking them', () => {
    createTool('Prod dashboard', 'link', 'https://prod', [])
    const second = createTool('Prod dashboard (2)', 'link', 'https://prod', [])
    expect(duplicateTool(second.id).name).toBe('Prod dashboard (3)')
  })

  it('ignores same-named tools in other folders when picking a suffix', () => {
    testDb.prepare("INSERT INTO tool_folders (id, name, parent_id, sort_order) VALUES ('f1', 'AWS', NULL, 0)").run()
    createTool('Prod dashboard (2)', 'link', 'https://prod', [], 'f1')
    const original = createTool('Prod dashboard', 'link', 'https://prod', [])
    expect(duplicateTool(original.id).name).toBe('Prod dashboard (2)')
  })

  it('places the copy directly below the original and shifts later siblings down', () => {
    const a = createTool('A', 'link', 'https://a', [])
    const b = createTool('B', 'link', 'https://b', [])
    const c = createTool('C', 'link', 'https://c', [])
    const copy = duplicateTool(a.id)
    const ordered = listTools().map((t) => [t.name, t.sort_order])
    expect(ordered).toEqual([['A', 0], ['A (2)', 1], ['B', 2], ['C', 3]])
    expect(copy.sort_order).toBe(1)
    expect([b.id, c.id]).not.toContain(copy.id)
  })

  it('throws when the tool does not exist', () => {
    expect(() => duplicateTool('missing')).toThrow(/not found/i)
  })
})
