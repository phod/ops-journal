import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { JournalEntry, HypothesisStatus } from '@shared/ipc-types'
import {
  resolveLinkedFindings,
  resolveLinkedActions,
  resolveChildHypotheses
} from '@shared/entry-types'

const SPACING_Y = 180
const FINDING_OFFSET_X = 320
const ACTION_OFFSET_X = -320
const FINDING_SPACING_Y = 80
const ACTION_SPACING_Y = 80

interface GraphResult {
  nodes: Node[]
  edges: Edge[]
}

export function useRelationshipGraph(
  entries: JournalEntry[],
  statusFilter: HypothesisStatus | 'all'
): GraphResult {
  return useMemo(() => {
    const hypotheses = entries.filter((e) => e.type === 'hypothesis')
    const nodeMap = new Map<string, Node>()
    const edges: Edge[] = []

    // Find root hypotheses (no parents)
    const rootHypotheses = hypotheses.filter((h) => {
      const parents = h.parent_hypothesis_ids ?? []
      // A root has no parents, or all parents are missing from entries
      return parents.length === 0 || parents.every((pid) => !entries.find((e) => e.id === pid))
    })

    // Filter by status if needed
    const filteredRoots =
      statusFilter === 'all'
        ? rootHypotheses
        : rootHypotheses.filter((h) => h.hypothesis_status === statusFilter)

    let globalY = 0

    function placeHypothesis(hypothesis: JournalEntry, x: number, y: number): number {
      if (nodeMap.has(hypothesis.id)) return 0

      // Apply status filter for non-root hypotheses too
      if (statusFilter !== 'all' && hypothesis.hypothesis_status !== statusFilter) {
        return 0
      }

      nodeMap.set(hypothesis.id, {
        id: hypothesis.id,
        type: 'relationship',
        position: { x, y },
        data: { entry: hypothesis }
      })

      const findings = resolveLinkedFindings(hypothesis, entries)
      const actions = resolveLinkedActions(hypothesis, entries)
      const children = resolveChildHypotheses(hypothesis, entries)

      // Place findings to the right
      findings.forEach((finding, i) => {
        const fy = y + i * FINDING_SPACING_Y - ((findings.length - 1) * FINDING_SPACING_Y) / 2

        if (!nodeMap.has(finding.id)) {
          nodeMap.set(finding.id, {
            id: finding.id,
            type: 'relationship',
            position: { x: x + FINDING_OFFSET_X, y: fy },
            data: { entry: finding }
          })
        }

        const edgeId = `e-${hypothesis.id}-finding-${finding.id}`
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: hypothesis.id,
            target: finding.id,
            sourceHandle: 'right',
            targetHandle: 'left',
            style: { stroke: '#2dd4bf', strokeWidth: 2 },
            data: { linkType: 'finding' }
          })
        }
      })

      // Place actions to the left
      actions.forEach((action, i) => {
        const ay = y + i * ACTION_SPACING_Y - ((actions.length - 1) * ACTION_SPACING_Y) / 2

        if (!nodeMap.has(action.id)) {
          nodeMap.set(action.id, {
            id: action.id,
            type: 'relationship',
            position: { x: x + ACTION_OFFSET_X, y: ay },
            data: { entry: action }
          })
        }

        const edgeId = `e-${hypothesis.id}-action-${action.id}`
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: hypothesis.id,
            target: action.id,
            sourceHandle: 'left',
            targetHandle: 'right',
            style: { stroke: '#fb923c', strokeWidth: 2 },
            data: { linkType: 'action' }
          })
        }
      })

      // Place child hypotheses below
      let childOffset = 0
      children.forEach((child) => {
        const childY = y + SPACING_Y + childOffset
        const added = placeHypothesis(child, x, childY)
        if (added > 0) {
          const edgeId = `e-${hypothesis.id}-child-${child.id}`
          edges.push({
            id: edgeId,
            source: hypothesis.id,
            target: child.id,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            style: { stroke: '#8b5cf6', strokeWidth: 2 },
            data: { linkType: 'hypothesis' }
          })
          childOffset += added
        }
      })

      const subtreeHeight = Math.max(
        SPACING_Y,
        childOffset || SPACING_Y,
        findings.length * FINDING_SPACING_Y,
        actions.length * ACTION_SPACING_Y
      )

      return subtreeHeight
    }

    // Place each root hypothesis
    filteredRoots.forEach((root) => {
      const height = placeHypothesis(root, 0, globalY)
      globalY += height
    })

    return {
      nodes: Array.from(nodeMap.values()),
      edges
    }
  }, [entries, statusFilter])
}
