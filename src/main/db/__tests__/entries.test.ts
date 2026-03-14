import Database from 'better-sqlite3'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

let testDb: Database.Database

vi.mock('../index', () => ({
  getDb: () => testDb
}))

import { createInvestigation } from '../investigations'
import { createEntry, listEntries, updateEntry, deleteEntry, getEntry, updateHypothesisStatus, linkHypothesisFinding, unlinkHypothesisFinding, getHypothesisFindings, getFindingHypotheses } from '../entries'

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

  it('defaults type to note when not provided', () => {
    const entry = createEntry(investigationId, 'A note')
    expect(entry.type).toBe('note')
  })

  it('stores action type correctly', () => {
    const entry = createEntry(investigationId, 'Restarted service', [], 'action')
    expect(entry.type).toBe('action')
  })

  it('stores finding type correctly', () => {
    const entry = createEntry(investigationId, 'Root cause found', [], 'finding')
    expect(entry.type).toBe('finding')
  })

  it('stores hypothesis type with open status', () => {
    const entry = createEntry(investigationId, 'Maybe the cache?', [], 'hypothesis')
    expect(entry.type).toBe('hypothesis')
    expect(entry.hypothesis_status).toBe('open')
    expect(entry.linked_finding_ids).toEqual([])
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

  it('returns the type field', () => {
    const created = createEntry(investigationId, 'Action entry', [], 'action')
    const found = getEntry(created.id)
    expect(found!.type).toBe('action')
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

  it('returns the type field for each entry', () => {
    createEntry(investigationId, 'Note', [], 'note')
    createEntry(investigationId, 'Action', [], 'action')
    createEntry(investigationId, 'Finding', [], 'finding')
    const entries = listEntries(investigationId)
    expect(entries[0].type).toBe('note')
    expect(entries[1].type).toBe('action')
    expect(entries[2].type).toBe('finding')
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

describe('hypothesis operations', () => {
  it('updateHypothesisStatus changes the status', () => {
    const entry = createEntry(investigationId, 'My hypothesis', [], 'hypothesis')
    expect(entry.hypothesis_status).toBe('open')
    const updated = updateHypothesisStatus(entry.id, 'true')
    expect(updated.hypothesis_status).toBe('true')
  })

  it('linkHypothesisFinding links a finding and returns updated hypothesis', () => {
    const hypothesis = createEntry(investigationId, 'Hypothesis', [], 'hypothesis')
    const finding = createEntry(investigationId, 'Finding', [], 'finding')
    const updated = linkHypothesisFinding(hypothesis.id, finding.id)
    expect(updated.linked_finding_ids).toContain(finding.id)
  })

  it('unlinkHypothesisFinding removes the link', () => {
    const hypothesis = createEntry(investigationId, 'Hypothesis', [], 'hypothesis')
    const finding = createEntry(investigationId, 'Finding', [], 'finding')
    linkHypothesisFinding(hypothesis.id, finding.id)
    const updated = unlinkHypothesisFinding(hypothesis.id, finding.id)
    expect(updated.linked_finding_ids).not.toContain(finding.id)
  })

  it('getHypothesisFindings returns linked findings', () => {
    const hypothesis = createEntry(investigationId, 'Hypothesis', [], 'hypothesis')
    const finding1 = createEntry(investigationId, 'Finding 1', [], 'finding')
    const finding2 = createEntry(investigationId, 'Finding 2', [], 'finding')
    linkHypothesisFinding(hypothesis.id, finding1.id)
    linkHypothesisFinding(hypothesis.id, finding2.id)
    const findings = getHypothesisFindings(hypothesis.id)
    expect(findings).toHaveLength(2)
    expect(findings.map((f) => f.id)).toContain(finding1.id)
    expect(findings.map((f) => f.id)).toContain(finding2.id)
  })

  it('getFindingHypotheses returns linked hypotheses', () => {
    const hypothesis = createEntry(investigationId, 'Hypothesis', [], 'hypothesis')
    const finding = createEntry(investigationId, 'Finding', [], 'finding')
    linkHypothesisFinding(hypothesis.id, finding.id)
    const hypotheses = getFindingHypotheses(finding.id)
    expect(hypotheses).toHaveLength(1)
    expect(hypotheses[0].id).toBe(hypothesis.id)
  })

  it('listEntries includes linked_finding_ids for hypothesis entries', () => {
    const hypothesis = createEntry(investigationId, 'Hypothesis', [], 'hypothesis')
    const finding = createEntry(investigationId, 'Finding', [], 'finding')
    linkHypothesisFinding(hypothesis.id, finding.id)
    const entries = listEntries(investigationId)
    const h = entries.find((e) => e.id === hypothesis.id)!
    expect(h.linked_finding_ids).toContain(finding.id)
  })

  it('cascade-deletes hypothesis_findings when hypothesis entry is deleted', () => {
    const hypothesis = createEntry(investigationId, 'Hypothesis', [], 'hypothesis')
    const finding = createEntry(investigationId, 'Finding', [], 'finding')
    linkHypothesisFinding(hypothesis.id, finding.id)
    testDb.prepare('DELETE FROM journal_entries WHERE id = ?').run(hypothesis.id)
    const hypotheses = getFindingHypotheses(finding.id)
    expect(hypotheses).toHaveLength(0)
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
