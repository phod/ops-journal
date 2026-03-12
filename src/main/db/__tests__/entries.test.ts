import Database from 'better-sqlite3'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

let testDb: Database.Database

vi.mock('../index', () => ({
  getDb: () => testDb
}))

import { createInvestigation } from '../investigations'
import { createEntry, listEntries, updateEntry, deleteEntry } from '../entries'

let investigationId: string

beforeEach(() => {
  testDb = createTestDb()
  const inv = createInvestigation('Test Investigation')
  investigationId = inv.id
})

afterEach(() => {
  testDb.close()
})

describe('createEntry', () => {
  it('creates an entry with body and investigation_id', () => {
    const entry = createEntry(investigationId, 'First note')
    expect(entry.body).toBe('First note')
    expect(entry.investigation_id).toBe(investigationId)
    expect(entry.id).toBeTruthy()
    expect(entry.created_at).toBeTruthy()
  })
})

describe('listEntries', () => {
  it('returns empty array for investigation with no entries', () => {
    expect(listEntries(investigationId)).toEqual([])
  })

  it('returns entries ordered by created_at ASC', () => {
    createEntry(investigationId, 'First')
    createEntry(investigationId, 'Second')
    createEntry(investigationId, 'Third')
    const entries = listEntries(investigationId)
    expect(entries).toHaveLength(3)
    expect(entries[0].body).toBe('First')
    expect(entries[2].body).toBe('Third')
  })

  it('only returns entries for the given investigation', () => {
    const other = createInvestigation('Other')
    createEntry(investigationId, 'Mine')
    createEntry(other.id, 'Theirs')
    expect(listEntries(investigationId)).toHaveLength(1)
    expect(listEntries(investigationId)[0].body).toBe('Mine')
  })
})

describe('updateEntry', () => {
  it('updates the body of an existing entry', () => {
    const entry = createEntry(investigationId, 'Original')
    const updated = updateEntry(entry.id, 'Updated text')
    expect(updated.body).toBe('Updated text')
    expect(updated.id).toBe(entry.id)
  })

  it('persists the update', () => {
    const entry = createEntry(investigationId, 'Before')
    updateEntry(entry.id, 'After')
    const entries = listEntries(investigationId)
    expect(entries[0].body).toBe('After')
  })
})

describe('deleteEntry', () => {
  it('removes the entry', () => {
    const entry = createEntry(investigationId, 'Doomed')
    deleteEntry(entry.id)
    expect(listEntries(investigationId)).toHaveLength(0)
  })

  it('does not affect other entries', () => {
    const keep = createEntry(investigationId, 'Keep')
    const del = createEntry(investigationId, 'Delete')
    deleteEntry(del.id)
    const remaining = listEntries(investigationId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(keep.id)
  })

  it('cascade-deletes entries when investigation is deleted', () => {
    createEntry(investigationId, 'Entry 1')
    createEntry(investigationId, 'Entry 2')
    testDb.prepare('DELETE FROM investigations WHERE id = ?').run(investigationId)
    expect(listEntries(investigationId)).toHaveLength(0)
  })
})
