import { useState, useCallback, useEffect } from 'react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange, Connection, Viewport } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { JournalEntry } from '@shared/ipc-types'
import type { BoardNode, BoardEdge, BoardViewport } from '@shared/board-types'
import { resolveLinkedFindings, resolveChildHypotheses, resolveParentHypotheses } from '@shared/entry-types'

function boardNodeToFlow(node: BoardNode): Node {
  return {
    id: node.id,
    type: node.node_type,
    position: { x: node.position_x, y: node.position_y },
    data: JSON.parse(node.data_json),
    width: node.width ?? undefined,
    height: node.height ?? undefined
  }
}

function boardEdgeToFlow(edge: BoardEdge): Edge {
  return {
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    label: edge.label ?? undefined,
    style: edge.style_json ? JSON.parse(edge.style_json) : undefined
  }
}

function flowNodeToBoard(node: Node, boardId: string): BoardNode {
  return {
    id: node.id,
    board_id: boardId,
    node_type: (node.type ?? 'textbox') as BoardNode['node_type'],
    position_x: node.position.x,
    position_y: node.position.y,
    width: node.measured?.width ?? null,
    height: node.measured?.height ?? null,
    data_json: JSON.stringify(node.data),
    created_at: ''
  }
}

function flowEdgeToBoard(edge: Edge, boardId: string): BoardEdge {
  return {
    id: edge.id,
    board_id: boardId,
    source_node_id: edge.source,
    target_node_id: edge.target,
    label: edge.label != null ? String(edge.label) : null,
    style_json: edge.style ? JSON.stringify(edge.style) : null
  }
}

export interface BoardStateHook {
  nodes: Node[]
  edges: Edge[]
  viewport: Viewport
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onViewportChange: (viewport: Viewport) => void
  addEntryNode: (entry: JournalEntry, position: { x: number; y: number }) => void
  addTextBoxNode: (position: { x: number; y: number }) => void
  addImageNode: (imagePath: string, position: { x: number; y: number }) => void
  updateTextBoxNode: (nodeId: string, text: string) => void
  explodeHypothesisNode: (nodeId: string) => void
  toBoardNodes: (boardId: string) => BoardNode[]
  toBoardEdges: (boardId: string) => BoardEdge[]
  toBoardViewport: () => BoardViewport
  isDirty: boolean
  setDirty: (dirty: boolean) => void
  loading: boolean
}

export function useBoardState(boardId: string | null, allEntries: JournalEntry[]): BoardStateHook {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [isDirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!boardId) {
      setNodes([])
      setEdges([])
      setViewport({ x: 0, y: 0, zoom: 1 })
      setDirty(false)
      return
    }

    setLoading(true)
    window.electronAPI.getBoardState(boardId).then((state) => {
      const flowNodes = state.nodes.map((n) => {
        const flowNode = boardNodeToFlow(n)
        // Hydrate entry nodes with actual entry data
        if (n.node_type === 'entry') {
          const entryId = (flowNode.data as { entryId: string }).entryId
          const entry = allEntries.find((e) => e.id === entryId) ?? null
          flowNode.data = { entryId, entry }
        }
        return flowNode
      })
      setNodes(flowNodes)
      setEdges(state.edges.map(boardEdgeToFlow))
      setViewport(state.viewport)
      setDirty(false)
    }).finally(() => setLoading(false))
  }, [boardId])

  // Re-hydrate entry nodes when entries change
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type !== 'entry') return n
        const entryId = (n.data as { entryId: string }).entryId
        const entry = allEntries.find((e) => e.id === entryId) ?? null
        if ((n.data as { entry: JournalEntry | null }).entry === entry) return n
        return { ...n, data: { ...n.data, entry } }
      })
    )
  }, [allEntries])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
    setDirty(true)
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
    setDirty(true)
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => [
      ...eds,
      {
        id: uuidv4(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined
      }
    ])
    setDirty(true)
  }, [])

  const onViewportChange = useCallback((vp: Viewport) => {
    setViewport(vp)
    setDirty(true)
  }, [])

  const addEntryNode = useCallback((entry: JournalEntry, position: { x: number; y: number }) => {
    setNodes((nds) => [
      ...nds,
      {
        id: uuidv4(),
        type: 'entry',
        position,
        data: { entryId: entry.id, entry }
      }
    ])
    setDirty(true)
  }, [])

  const addTextBoxNode = useCallback((position: { x: number; y: number }) => {
    const id = uuidv4()
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'textbox',
        position,
        data: { text: '' }
      }
    ])
    setDirty(true)
  }, [])

  const addImageNode = useCallback((imagePath: string, position: { x: number; y: number }) => {
    setNodes((nds) => [
      ...nds,
      {
        id: uuidv4(),
        type: 'image',
        position,
        data: { imagePath }
      }
    ])
    setDirty(true)
  }, [])

  const updateTextBoxNode = useCallback((nodeId: string, text: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, text } } : n))
    )
    setDirty(true)
  }, [])

  const explodeHypothesisNode = useCallback((nodeId: string) => {
    setNodes((currentNodes) => {
      const sourceNode = currentNodes.find((n) => n.id === nodeId)
      if (!sourceNode || sourceNode.type !== 'entry') return currentNodes

      const entry = (sourceNode.data as { entry: JournalEntry | null }).entry
      if (!entry || entry.type !== 'hypothesis') return currentNodes

      // Track all entries already on the board or being created
      const entryIdToNodeId = new Map<string, string>()
      for (const n of currentNodes) {
        if (n.type === 'entry') {
          entryIdToNodeId.set((n.data as { entryId: string }).entryId, n.id)
        }
      }

      const spacingX = 320
      const spacingY = 160

      // BFS through hypothesis graph
      // Each queued item: { entry, depth (negative=parent, positive=child) }
      interface QueueItem { entry: JournalEntry; depth: number; parentHypothesisEntryId: string | null }
      const queue: QueueItem[] = [{ entry, depth: 0, parentHypothesisEntryId: null }]
      const visited = new Set<string>([entry.id])

      // Collect hypotheses by depth, and findings attached to each hypothesis
      const hypothesesByDepth = new Map<number, JournalEntry[]>()
      hypothesesByDepth.set(0, [entry])
      const findingsByHypothesisId = new Map<string, JournalEntry[]>()
      // Track parent→child edges (parentEntryId → childEntryId)
      const hierarchyEdges: Array<{ parentEntryId: string; childEntryId: string }> = []
      // Track hypothesis→finding edges
      const findingEdges: Array<{ hypothesisEntryId: string; findingEntryId: string }> = []

      while (queue.length > 0) {
        const { entry: current, depth } = queue.shift()!

        if (current.type !== 'hypothesis') continue

        // Collect findings for this hypothesis
        const findings = resolveLinkedFindings(current, allEntries)
        const newFindings = findings.filter((f) => !visited.has(f.id))
        newFindings.forEach((f) => visited.add(f.id))
        if (newFindings.length > 0) {
          findingsByHypothesisId.set(current.id, [
            ...(findingsByHypothesisId.get(current.id) ?? []),
            ...newFindings
          ])
        }
        for (const f of findings) {
          findingEdges.push({ hypothesisEntryId: current.id, findingEntryId: f.id })
        }

        // Traverse children (deeper depth)
        const children = resolveChildHypotheses(current, allEntries)
        for (const child of children) {
          hierarchyEdges.push({ parentEntryId: current.id, childEntryId: child.id })
          if (!visited.has(child.id)) {
            visited.add(child.id)
            const childDepth = depth + 1
            const bucket = hypothesesByDepth.get(childDepth) ?? []
            bucket.push(child)
            hypothesesByDepth.set(childDepth, bucket)
            queue.push({ entry: child, depth: childDepth, parentHypothesisEntryId: current.id })
          }
        }

        // Traverse parents (shallower depth)
        const parents = resolveParentHypotheses(current, allEntries)
        for (const parent of parents) {
          hierarchyEdges.push({ parentEntryId: parent.id, childEntryId: current.id })
          if (!visited.has(parent.id)) {
            visited.add(parent.id)
            const parentDepth = depth - 1
            const bucket = hypothesesByDepth.get(parentDepth) ?? []
            bucket.push(parent)
            hypothesesByDepth.set(parentDepth, bucket)
            queue.push({ entry: parent, depth: parentDepth, parentHypothesisEntryId: null })
          }
        }
      }

      // Position hypotheses by depth layer, centered on source X
      const sx = sourceNode.position.x
      const sy = sourceNode.position.y
      const entryIdToPosition = new Map<string, { x: number; y: number }>()
      entryIdToPosition.set(entry.id, { x: sx, y: sy })

      for (const [depth, hypotheses] of hypothesesByDepth) {
        if (depth === 0) continue // source already placed
        const startX = sx - ((hypotheses.length - 1) * spacingX) / 2
        hypotheses.forEach((h, i) => {
          entryIdToPosition.set(h.id, {
            x: startX + i * spacingX,
            y: sy + depth * spacingY * 2
          })
        })
      }

      // Position findings to the right of their hypothesis
      for (const [hypId, findings] of findingsByHypothesisId) {
        const hypPos = entryIdToPosition.get(hypId)
        if (!hypPos) continue
        const startY = hypPos.y - ((findings.length - 1) * spacingY) / 2
        findings.forEach((f, i) => {
          entryIdToPosition.set(f.id, {
            x: hypPos.x + spacingX,
            y: startY + i * spacingY
          })
        })
      }

      // Create new nodes (skip entries already on the board)
      const newNodes: Node[] = []
      for (const [entryId, pos] of entryIdToPosition) {
        if (entryIdToNodeId.has(entryId)) continue
        const e = allEntries.find((a) => a.id === entryId)
        if (!e) continue
        const nid = uuidv4()
        entryIdToNodeId.set(entryId, nid)
        newNodes.push({
          id: nid,
          type: 'entry',
          position: pos,
          data: { entryId, entry: e }
        })
      }

      if (newNodes.length === 0) return currentNodes

      // Create edges
      const newEdges: Edge[] = []
      const edgeSet = new Set<string>()

      for (const { parentEntryId, childEntryId } of hierarchyEdges) {
        const sourceId = entryIdToNodeId.get(parentEntryId)
        const targetId = entryIdToNodeId.get(childEntryId)
        if (!sourceId || !targetId) continue
        const key = `${sourceId}->${targetId}`
        if (edgeSet.has(key)) continue
        edgeSet.add(key)
        newEdges.push({ id: uuidv4(), source: sourceId, target: targetId })
      }

      for (const { hypothesisEntryId, findingEntryId } of findingEdges) {
        const sourceId = entryIdToNodeId.get(hypothesisEntryId)
        const targetId = entryIdToNodeId.get(findingEntryId)
        if (!sourceId || !targetId) continue
        const key = `${sourceId}->${targetId}`
        if (edgeSet.has(key)) continue
        edgeSet.add(key)
        newEdges.push({
          id: uuidv4(),
          source: sourceId,
          target: targetId,
          sourceHandle: 'right-source',
          targetHandle: 'left-target'
        })
      }

      setEdges((eds) => [...eds, ...newEdges])
      setDirty(true)

      return [...currentNodes, ...newNodes]
    })
  }, [allEntries])

  const toBoardNodes = useCallback(
    (boardId: string) => nodes.map((n) => flowNodeToBoard(n, boardId)),
    [nodes]
  )

  const toBoardEdges = useCallback(
    (boardId: string) => edges.map((e) => flowEdgeToBoard(e, boardId)),
    [edges]
  )

  const toBoardViewport = useCallback((): BoardViewport => viewport, [viewport])

  return {
    nodes,
    edges,
    viewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onViewportChange,
    addEntryNode,
    addTextBoxNode,
    addImageNode,
    updateTextBoxNode,
    explodeHypothesisNode,
    toBoardNodes,
    toBoardEdges,
    toBoardViewport,
    isDirty,
    setDirty,
    loading
  }
}
