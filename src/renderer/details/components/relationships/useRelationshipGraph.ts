import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { JournalEntry, HypothesisStatus } from '@shared/ipc-types'
import {
  resolveLinkedFindings,
  resolveLinkedActions,
  resolveChildHypotheses
} from '@shared/entry-types'

const NODE_HEIGHT = 80
const NODE_GAP = 20
const SPACING_Y = NODE_HEIGHT + NODE_GAP
const HYPOTHESIS_WIDTH = 200
const LEAF_NODE_WIDTH = 170
const COLUMN_GAP = 60
const CHILD_INDENT_X = HYPOTHESIS_WIDTH + COLUMN_GAP

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

    // Track next available Y per X column to prevent overlaps
    const columnNextY = new Map<number, number>()

    function getNextY(columnX: number, desiredY: number): number {
      const nextAvailable = columnNextY.get(columnX) ?? 0
      const y = Math.max(desiredY, nextAvailable)
      columnNextY.set(columnX, y + SPACING_Y)
      return y
    }

    // Find root hypotheses (no parents)
    const rootHypotheses = hypotheses.filter((h) => {
      const parents = h.parent_hypothesis_ids ?? []
      return parents.length === 0 || parents.every((pid) => !entries.find((e) => e.id === pid))
    })

    // Filter by status if needed
    const filteredRoots =
      statusFilter === 'all'
        ? rootHypotheses
        : rootHypotheses.filter((h) => h.hypothesis_status === statusFilter)

    // Compute max depth of the hypothesis tree so we can place findings/actions
    // in columns that won't collide with any hypothesis at any depth
    function getMaxDepth(hypothesis: JournalEntry, visited: Set<string>): number {
      if (visited.has(hypothesis.id)) return 0
      if (statusFilter !== 'all' && hypothesis.hypothesis_status !== statusFilter) return 0
      visited.add(hypothesis.id)
      const children = resolveChildHypotheses(hypothesis, entries)
      if (children.length === 0) return 0
      return 1 + Math.max(...children.map((c) => getMaxDepth(c, visited)))
    }

    const visited = new Set<string>()
    const maxDepth = filteredRoots.reduce(
      (max, root) => Math.max(max, getMaxDepth(root, visited)),
      0
    )

    // Findings go in a column to the right of the deepest hypothesis
    const findingsX = (maxDepth + 1) * CHILD_INDENT_X
    // Actions go in a column to the left of the root
    const actionsX = -(LEAF_NODE_WIDTH + COLUMN_GAP)

    let globalY = 0

    function placeHypothesis(hypothesis: JournalEntry, x: number, y: number): number {
      if (nodeMap.has(hypothesis.id)) return 0

      if (statusFilter !== 'all' && hypothesis.hypothesis_status !== statusFilter) {
        return 0
      }

      const hypothesisY = getNextY(x, y)

      nodeMap.set(hypothesis.id, {
        id: hypothesis.id,
        type: 'relationship',
        position: { x, y: hypothesisY },
        data: { entry: hypothesis }
      })

      const findings = resolveLinkedFindings(hypothesis, entries)
      const actions = resolveLinkedActions(hypothesis, entries)
      const children = resolveChildHypotheses(hypothesis, entries)

      let maxFindingBottom = hypothesisY
      let maxActionBottom = hypothesisY

      // Place findings in the shared findings column
      findings.forEach((finding) => {
        if (!nodeMap.has(finding.id)) {
          const fy = getNextY(findingsX, hypothesisY)
          nodeMap.set(finding.id, {
            id: finding.id,
            type: 'relationship',
            position: { x: findingsX, y: fy },
            data: { entry: finding }
          })
          maxFindingBottom = Math.max(maxFindingBottom, fy + NODE_HEIGHT)
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

      // Place actions in the shared actions column
      actions.forEach((action) => {
        if (!nodeMap.has(action.id)) {
          const ay = getNextY(actionsX, hypothesisY)
          nodeMap.set(action.id, {
            id: action.id,
            type: 'relationship',
            position: { x: actionsX, y: ay },
            data: { entry: action }
          })
          maxActionBottom = Math.max(maxActionBottom, ay + NODE_HEIGHT)
        }

        const edgeId = `e-${hypothesis.id}-action-${action.id}`
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: hypothesis.id,
            target: action.id,
            sourceHandle: 'left-source',
            targetHandle: 'right-target',
            style: { stroke: '#fb923c', strokeWidth: 2 },
            data: { linkType: 'action' }
          })
        }
      })

      // Place child hypotheses indented to the right
      let childOffset = 0
      const childX = x + CHILD_INDENT_X
      children.forEach((child) => {
        const childY = hypothesisY + SPACING_Y + childOffset
        const added = placeHypothesis(child, childX, childY)
        if (added > 0) {
          const edgeId = `e-${hypothesis.id}-child-${child.id}`
          edges.push({
            id: edgeId,
            source: hypothesis.id,
            target: child.id,
            sourceHandle: 'right',
            targetHandle: 'left',
            style: { stroke: '#8b5cf6', strokeWidth: 2 },
            data: { linkType: 'hypothesis' }
          })
          childOffset += added
        }
      })

      const subtreeHeight = Math.max(
        SPACING_Y,
        childOffset || SPACING_Y,
        maxFindingBottom - hypothesisY + NODE_GAP,
        maxActionBottom - hypothesisY + NODE_GAP
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
