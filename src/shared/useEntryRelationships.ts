import type { JournalEntry } from '@shared/ipc-types'
import { resolveLinkedFindings, resolveLinkedActions, resolveChildHypotheses } from '@shared/entry-types'

export function useEntryRelationships(entry: JournalEntry, allEntries: JournalEntry[]) {
  const isHypothesis = entry.type === 'hypothesis'
  const isFinding = entry.type === 'finding'
  const isAction = entry.type === 'action'

  const linkedFindings = isHypothesis
    ? resolveLinkedFindings(entry, allEntries)
    : []

  const linkedActions = isHypothesis
    ? resolveLinkedActions(entry, allEntries)
    : []

  const linkedChildHypotheses = isHypothesis
    ? resolveChildHypotheses(entry, allEntries)
    : []

  const parentHypotheses = isHypothesis
    ? allEntries.filter((e) => e.type === 'hypothesis' && e.linked_child_hypothesis_ids?.includes(entry.id))
    : []

  const linkedHypotheses = (isFinding || isAction)
    ? allEntries.filter((e) => e.type === 'hypothesis' && (
        (isFinding && e.linked_finding_ids?.includes(entry.id)) ||
        (isAction && e.linked_action_ids?.includes(entry.id))
      ))
    : []

  return { linkedFindings, linkedActions, linkedChildHypotheses, parentHypotheses, linkedHypotheses }
}
