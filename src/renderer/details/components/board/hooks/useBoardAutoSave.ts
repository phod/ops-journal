import { useEffect, useRef } from 'react'
import type { BoardNode, BoardEdge, BoardViewport } from '@shared/board-types'

interface AutoSaveProps {
  boardId: string | null
  isDirty: boolean
  setDirty: (dirty: boolean) => void
  toBoardNodes: (boardId: string) => BoardNode[]
  toBoardEdges: (boardId: string) => BoardEdge[]
  toBoardViewport: () => BoardViewport
}

export function useBoardAutoSave({
  boardId,
  isDirty,
  setDirty,
  toBoardNodes,
  toBoardEdges,
  toBoardViewport
}: AutoSaveProps): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(isDirty)
  const boardIdRef = useRef(boardId)

  dirtyRef.current = isDirty
  boardIdRef.current = boardId

  const save = useRef(() => {
    const id = boardIdRef.current
    if (!id || !dirtyRef.current) return
    const nodes = toBoardNodes(id)
    const edges = toBoardEdges(id)
    const viewport = toBoardViewport()
    window.electronAPI.saveBoardState(id, { nodes, edges, viewport })
    setDirty(false)
  })

  // Keep save ref current
  save.current = () => {
    const id = boardIdRef.current
    if (!id || !dirtyRef.current) return
    const nodes = toBoardNodes(id)
    const edges = toBoardEdges(id)
    const viewport = toBoardViewport()
    window.electronAPI.saveBoardState(id, { nodes, edges, viewport })
    setDirty(false)
  }

  // Debounced save on dirty
  useEffect(() => {
    if (!isDirty || !boardId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save.current(), 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isDirty, boardId])

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      save.current()
    }
  }, [])
}
