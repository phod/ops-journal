import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useEntryRelationships } from '../useEntryRelationships'
import type { JournalEntry } from '@shared/ipc-types'

function makeEntry(overrides: Partial<JournalEntry> & { id: string }): JournalEntry {
  return {
    investigation_id: 'inv-1',
    body: 'body',
    image_paths: [],
    created_at: '2024-01-01 10:00:00',
    type: 'note',
    ...overrides
  }
}

describe('useEntryRelationships', () => {
  const finding1 = makeEntry({ id: 'f1', type: 'finding' })
  const finding2 = makeEntry({ id: 'f2', type: 'finding' })
  const childHyp = makeEntry({ id: 'child-h1', type: 'hypothesis' })
  const parentHyp = makeEntry({
    id: 'parent-h1',
    type: 'hypothesis',
    linked_child_hypothesis_ids: ['h1']
  })

  const hypothesis = makeEntry({
    id: 'h1',
    type: 'hypothesis',
    linked_finding_ids: ['f1', 'f2'],
    linked_child_hypothesis_ids: ['child-h1']
  })

  const allEntries = [finding1, finding2, childHyp, parentHyp, hypothesis]

  it('resolves linked findings for a hypothesis', () => {
    const { result } = renderHook(() => useEntryRelationships(hypothesis, allEntries))

    expect(result.current.linkedFindings).toEqual([finding1, finding2])
  })

  it('resolves child hypotheses for a hypothesis', () => {
    const { result } = renderHook(() => useEntryRelationships(hypothesis, allEntries))

    expect(result.current.linkedChildHypotheses).toEqual([childHyp])
  })

  it('resolves parent hypotheses for a hypothesis', () => {
    const { result } = renderHook(() => useEntryRelationships(hypothesis, allEntries))

    expect(result.current.parentHypotheses).toEqual([parentHyp])
  })

  it('resolves linked hypotheses for a finding', () => {
    const { result } = renderHook(() => useEntryRelationships(finding1, allEntries))

    expect(result.current.linkedHypotheses).toEqual([hypothesis])
  })

  it('returns empty arrays for a note entry', () => {
    const note = makeEntry({ id: 'n1', type: 'note' })
    const { result } = renderHook(() => useEntryRelationships(note, allEntries))

    expect(result.current.linkedFindings).toEqual([])
    expect(result.current.linkedChildHypotheses).toEqual([])
    expect(result.current.parentHypotheses).toEqual([])
    expect(result.current.linkedHypotheses).toEqual([])
  })

  it('returns empty arrays for an action entry', () => {
    const action = makeEntry({ id: 'a1', type: 'action' })
    const { result } = renderHook(() => useEntryRelationships(action, allEntries))

    expect(result.current.linkedFindings).toEqual([])
    expect(result.current.linkedChildHypotheses).toEqual([])
    expect(result.current.parentHypotheses).toEqual([])
    expect(result.current.linkedHypotheses).toEqual([])
  })

  it('handles hypothesis with no linked IDs', () => {
    const bareHyp = makeEntry({ id: 'bare', type: 'hypothesis' })
    const { result } = renderHook(() => useEntryRelationships(bareHyp, allEntries))

    expect(result.current.linkedFindings).toEqual([])
    expect(result.current.linkedChildHypotheses).toEqual([])
    expect(result.current.parentHypotheses).toEqual([])
  })

  it('handles finding with no linked hypotheses', () => {
    const orphanFinding = makeEntry({ id: 'orphan', type: 'finding' })
    const { result } = renderHook(() => useEntryRelationships(orphanFinding, allEntries))

    expect(result.current.linkedHypotheses).toEqual([])
  })

  it('handles linked IDs that reference non-existent entries', () => {
    const hyp = makeEntry({
      id: 'ghost-links',
      type: 'hypothesis',
      linked_finding_ids: ['nonexistent'],
      linked_child_hypothesis_ids: ['also-nonexistent']
    })
    const { result } = renderHook(() => useEntryRelationships(hyp, allEntries))

    expect(result.current.linkedFindings).toEqual([])
    expect(result.current.linkedChildHypotheses).toEqual([])
  })
})
