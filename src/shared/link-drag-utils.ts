import type { JournalEntry } from './ipc-types'

export type LinkActionType = 'hypothesis-finding' | 'hypothesis-action' | 'hypothesis-child'

export interface LinkAction {
  type: LinkActionType
  hypothesisId: string
  otherId: string
}

/**
 * Determine the link action for two entries, or null if they can't be linked.
 * For hypothesis↔hypothesis, source = child, target = parent.
 */
export function getLinkAction(source: JournalEntry, target: JournalEntry): LinkAction | null {
  if (source.id === target.id) return null

  const sType = source.type
  const tType = target.type

  // hypothesis + finding
  if (sType === 'hypothesis' && tType === 'finding') {
    return { type: 'hypothesis-finding', hypothesisId: source.id, otherId: target.id }
  }
  if (sType === 'finding' && tType === 'hypothesis') {
    return { type: 'hypothesis-finding', hypothesisId: target.id, otherId: source.id }
  }

  // hypothesis + action
  if (sType === 'hypothesis' && tType === 'action') {
    return { type: 'hypothesis-action', hypothesisId: source.id, otherId: target.id }
  }
  if (sType === 'action' && tType === 'hypothesis') {
    return { type: 'hypothesis-action', hypothesisId: target.id, otherId: source.id }
  }

  // hypothesis + hypothesis → source is child, target is parent
  if (sType === 'hypothesis' && tType === 'hypothesis') {
    return { type: 'hypothesis-child', hypothesisId: target.id, otherId: source.id }
  }

  return null
}

/**
 * Check if two entries are already linked.
 */
function areAlreadyLinked(source: JournalEntry, target: JournalEntry): boolean {
  const action = getLinkAction(source, target)
  if (!action) return false

  switch (action.type) {
    case 'hypothesis-finding': {
      const hyp = source.type === 'hypothesis' ? source : target
      const finding = source.type === 'finding' ? source : target
      return hyp.linked_finding_ids?.includes(finding.id) ?? false
    }
    case 'hypothesis-action': {
      const hyp = source.type === 'hypothesis' ? source : target
      const act = source.type === 'action' ? source : target
      return hyp.linked_action_ids?.includes(act.id) ?? false
    }
    case 'hypothesis-child': {
      // target = parent, source = child
      return target.linked_child_hypothesis_ids?.includes(source.id) ?? false
    }
  }
}

/**
 * Get all ancestors of a hypothesis to prevent cycles in hypothesis↔hypothesis linking.
 */
function getAncestorIds(entryId: string, allEntries: JournalEntry[]): Set<string> {
  const ancestors = new Set<string>()
  const queue = [entryId]
  while (queue.length > 0) {
    const current = queue.pop()!
    const entry = allEntries.find((e) => e.id === current)
    if (!entry) continue
    for (const parentId of entry.parent_hypothesis_ids ?? []) {
      if (!ancestors.has(parentId)) {
        ancestors.add(parentId)
        queue.push(parentId)
      }
    }
  }
  return ancestors
}

/**
 * Precompute valid drop target IDs for a given drag source.
 */
export function getValidTargetIds(source: JournalEntry, allEntries: JournalEntry[]): Set<string> {
  const valid = new Set<string>()
  const sType = source.type

  // Only hypothesis, finding, and action can participate in links
  if (sType !== 'hypothesis' && sType !== 'finding' && sType !== 'action') return valid

  // For hypothesis→hypothesis, precompute ancestors to prevent cycles
  const ancestorIds = sType === 'hypothesis' ? getAncestorIds(source.id, allEntries) : new Set<string>()

  for (const target of allEntries) {
    if (target.id === source.id) continue

    const action = getLinkAction(source, target)
    if (!action) continue

    if (areAlreadyLinked(source, target)) continue

    // For hypothesis→hypothesis: don't allow dropping onto an ancestor (creates cycle)
    if (action.type === 'hypothesis-child' && ancestorIds.has(target.id)) continue

    valid.add(target.id)
  }

  return valid
}
