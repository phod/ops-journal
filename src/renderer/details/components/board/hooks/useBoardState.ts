import { useState, useCallback, useEffect } from 'react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange, Connection, Viewport } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { JournalEntry } from '@shared/ipc-types'
import type { BoardNode, BoardEdge, BoardViewport } from '@shared/board-types'

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
    toBoardNodes,
    toBoardEdges,
    toBoardViewport,
    isDirty,
    setDirty,
    loading
  }
}
