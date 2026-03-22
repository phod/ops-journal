import { useRef, useCallback, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'

export interface BoardSnapshot {
  nodes: Node[]
  edges: Edge[]
}

const MAX_HISTORY = 50

export interface BoardHistoryHook {
  pushSnapshot: () => void
  undo: () => BoardSnapshot | null
  redo: () => BoardSnapshot | null
  canUndo: () => boolean
  canRedo: () => boolean
}

export function useBoardHistory(
  boardId: string | null,
  nodesRef: () => Node[],
  edgesRef: () => Edge[]
): BoardHistoryHook {
  const pastRef = useRef<BoardSnapshot[]>([])
  const futureRef = useRef<BoardSnapshot[]>([])

  // Reset stacks when board changes
  useEffect(() => {
    pastRef.current = []
    futureRef.current = []
  }, [boardId])

  const pushSnapshot = useCallback(() => {
    const snapshot: BoardSnapshot = {
      nodes: nodesRef(),
      edges: edgesRef()
    }
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot]
    futureRef.current = []
  }, [nodesRef, edgesRef])

  const undo = useCallback((): BoardSnapshot | null => {
    if (pastRef.current.length === 0) return null

    const previous = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)

    const currentSnapshot: BoardSnapshot = {
      nodes: nodesRef(),
      edges: edgesRef()
    }
    futureRef.current = [...futureRef.current, currentSnapshot]

    return previous
  }, [nodesRef, edgesRef])

  const redo = useCallback((): BoardSnapshot | null => {
    if (futureRef.current.length === 0) return null

    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)

    const currentSnapshot: BoardSnapshot = {
      nodes: nodesRef(),
      edges: edgesRef()
    }
    pastRef.current = [...pastRef.current, currentSnapshot]

    return next
  }, [nodesRef, edgesRef])

  const canUndo = useCallback(() => pastRef.current.length > 0, [])
  const canRedo = useCallback(() => futureRef.current.length > 0, [])

  return { pushSnapshot, undo, redo, canUndo, canRedo }
}
