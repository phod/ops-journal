import Database from 'better-sqlite3'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

let testDb: Database.Database

vi.mock('../index', () => ({
  getDb: () => testDb
}))

import { createInvestigation } from '../investigations'
import { createEntry, listEntries, updateEntry, deleteEntry, getEntry } from '../entries'

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
    expect(entry.image_paths).toEqual([])
  })

  it('creates an entry with image paths', () => {
    const entry = createEntry(investigationId, 'With image', ['/path/to/image.png'])
    expect(entry.body).toBe('With image')
    expect(entry.image_paths).toEqual(['/path/to/image.png'])
  })

  it('creates an entry with multiple image paths', () => {
    const paths = ['/a.png', '/b.png', '/c.png']
    const entry = createEntry(investigationId, 'Multi', paths)
    expect(entry.image_paths).toEqual(paths)
  })

  it('stores empty image_paths when not provided', () => {
    const entry = createEntry(investigationId, 'No image')
    expect(entry.image_paths).toEqual([])
  })
})

describe('getEntry', () => {
  it('returns the entry by id', () => {
    const created = createEntry(investigationId, 'Find me')
    const found = getEntry(created.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(created.id)
    expect(found!.body).toBe('Find me')
  })

  it('returns undefined for a non-existent id', () => {
    expect(getEntry('non-existent')).toBeUndefined()
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

  it('includes image_paths for each entry', () => {
    createEntry(investigationId, 'With images', ['/a.png', '/b.png'])
    createEntry(investigationId, 'No images')
    const entries = listEntries(investigationId)
    expect(entries[0].image_paths).toEqual(['/a.png', '/b.png'])
    expect(entries[1].image_paths).toEqual([])
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

  it('preserves image_paths when keepImagePaths is undefined', () => {
    const entry = createEntry(investigationId, 'Has image', ['/img/path.png'])
    const updated = updateEntry(entry.id, 'New body')
    expect(updated.image_paths).toEqual(['/img/path.png'])
  })

  it('removes specified images when keepImagePaths is provided', () => {
    const entry = createEntry(investigationId, 'Two images', ['/a.png', '/b.png'])
    const updated = updateEntry(entry.id, 'Keep one', ['/a.png'])
    expect(updated.image_paths).toEqual(['/a.png'])
  })

  it('removes all images when keepImagePaths is an empty array', () => {
    const entry = createEntry(investigationId, 'Has images', ['/a.png', '/b.png'])
    const updated = updateEntry(entry.id, 'No images', [])
    expect(updated.image_paths).toEqual([])
  })

  it('removes all images when keepImagePaths is null', () => {
    const entry = createEntry(investigationId, 'Has image', ['/img/path.png'])
    const updated = updateEntry(entry.id, 'Cleared', null)
    expect(updated.image_paths).toEqual([])
  })
})

describe('deleteEntry', () => {
  it('removes the entry', () => {
    const entry = createEntry(investigationId, 'Doomed')
    deleteEntry(entry.id)
    expect(listEntries(investigationId)).toHaveLength(0)
  })

  it('returns the deleted entry with image_paths', () => {
    const entry = createEntry(investigationId, 'Return me', ['/img.png'])
    const deleted = deleteEntry(entry.id)
    expect(deleted).toBeDefined()
    expect(deleted!.id).toBe(entry.id)
    expect(deleted!.image_paths).toEqual(['/img.png'])
  })

  it('returns undefined when entry does not exist', () => {
    expect(deleteEntry('non-existent')).toBeUndefined()
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
