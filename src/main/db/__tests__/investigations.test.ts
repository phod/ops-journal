import Database from 'better-sqlite3'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

let testDb: Database.Database

vi.mock('../index', () => ({
  getDb: () => testDb
}))

import {
  createInvestigation,
  listInvestigations,
  getActiveInvestigation,
  setActiveInvestigation,
  deleteInvestigation
} from '../investigations'

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb.close()
})

describe('createInvestigation', () => {
  it('creates an investigation with the given name', () => {
    const inv = createInvestigation('Test Incident')
    expect(inv.name).toBe('Test Incident')
    expect(inv.id).toBeTruthy()
    expect(inv.is_active).toBe(0)
    expect(inv.created_at).toBeTruthy()
  })

  it('creates multiple investigations independently', () => {
    createInvestigation('Alpha')
    createInvestigation('Beta')
    expect(listInvestigations()).toHaveLength(2)
  })
})

describe('listInvestigations', () => {
  it('returns empty array when no investigations exist', () => {
    expect(listInvestigations()).toEqual([])
  })

  it('returns investigations ordered by created_at DESC', () => {
    testDb.prepare(
      "INSERT INTO investigations (id, name, is_active, created_at) VALUES ('id-1', 'First', 0, '2024-01-01 10:00:00')"
    ).run()
    testDb.prepare(
      "INSERT INTO investigations (id, name, is_active, created_at) VALUES ('id-2', 'Second', 0, '2024-01-01 11:00:00')"
    ).run()
    const list = listInvestigations()
    expect(list[0].name).toBe('Second')
    expect(list[1].name).toBe('First')
  })
})

describe('getActiveInvestigation', () => {
  it('returns null when no investigation is active', () => {
    createInvestigation('Inactive')
    expect(getActiveInvestigation()).toBeNull()
  })

  it('returns the active investigation', () => {
    const inv = createInvestigation('Active One')
    setActiveInvestigation(inv.id)
    const active = getActiveInvestigation()
    expect(active?.id).toBe(inv.id)
    expect(active?.is_active).toBe(1)
  })
})

describe('setActiveInvestigation', () => {
  it('sets an investigation as active', () => {
    const inv = createInvestigation('To Activate')
    setActiveInvestigation(inv.id)
    expect(getActiveInvestigation()?.id).toBe(inv.id)
  })

  it('replaces a previously active investigation', () => {
    const first = createInvestigation('First')
    const second = createInvestigation('Second')

    setActiveInvestigation(first.id)
    expect(getActiveInvestigation()?.id).toBe(first.id)

    setActiveInvestigation(second.id)
    expect(getActiveInvestigation()?.id).toBe(second.id)

    const all = listInvestigations()
    const firstRow = all.find((i) => i.id === first.id)
    expect(firstRow?.is_active).toBe(0)
  })

  it('only one investigation can be active at a time', () => {
    const a = createInvestigation('A')
    const b = createInvestigation('B')
    setActiveInvestigation(a.id)
    setActiveInvestigation(b.id)

    const active = listInvestigations().filter((i) => i.is_active === 1)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(b.id)
  })
})

describe('deleteInvestigation', () => {
  it('removes the investigation', () => {
    const inv = createInvestigation('To Delete')
    deleteInvestigation(inv.id)
    expect(listInvestigations()).toHaveLength(0)
  })

  it('does not affect other investigations', () => {
    const keep = createInvestigation('Keep')
    const del = createInvestigation('Delete')
    deleteInvestigation(del.id)
    const remaining = listInvestigations()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(keep.id)
  })
})
