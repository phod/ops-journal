import { useEffect, useState, useCallback, useRef } from 'react'
import type { NodeChange, EdgeChange } from '@xyflow/react'
import type { JournalEntry } from '@shared/ipc-types'
import type { RumourBoard, ShapeKind, EdgeArrowDirection } from '@shared/board-types'
import { BoardSelector } from './BoardSelector'
import { BoardCanvas } from './BoardCanvas'
import { BoardSidebar } from './BoardSidebar'
import { useBoardState } from './hooks/useBoardState'
import { useBoardAutoSave } from './hooks/useBoardAutoSave'
import { useBoardHistory } from './hooks/useBoardHistory'

interface Props {
  investigationId: string
  entries: JournalEntry[]
}

export function RumourBoardView({ investigationId, entries }: Props) {
  const [boards, setBoards] = useState<RumourBoard[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const boardState = useBoardState(selectedBoardId, entries)

  // Keep refs for current nodes/edges so history can snapshot without stale closures
  const nodesRef = useRef(boardState.nodes)
  const edgesRef = useRef(boardState.edges)
  nodesRef.current = boardState.nodes
  edgesRef.current = boardState.edges

  const getNodes = useCallback(() => nodesRef.current, [])
  const getEdges = useCallback(() => edgesRef.current, [])

  const history = useBoardHistory(selectedBoardId, getNodes, getEdges)

  useBoardAutoSave({
    boardId: selectedBoardId,
    isDirty: boardState.isDirty,
    setDirty: boardState.setDirty,
    toBoardNodes: boardState.toBoardNodes,
    toBoardEdges: boardState.toBoardEdges,
    toBoardViewport: boardState.toBoardViewport
  })

  // Undo/redo applies snapshot and marks dirty so auto-save persists
  const applyUndo = useCallback(() => {
    const snapshot = history.undo()
    if (!snapshot) return
    boardState.setNodes(snapshot.nodes)
    boardState.setEdges(snapshot.edges)
    boardState.setDirty(true)
  }, [history, boardState])

  const applyRedo = useCallback(() => {
    const snapshot = history.redo()
    if (!snapshot) return
    boardState.setNodes(snapshot.nodes)
    boardState.setEdges(snapshot.edges)
    boardState.setDirty(true)
  }, [history, boardState])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey || e.key.toLowerCase() !== 'z') return

      // Don't intercept native text undo in inputs/textareas
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      // Also skip contenteditable elements
      if (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) return

      e.preventDefault()
      if (e.shiftKey) {
        applyRedo()
      } else {
        applyUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [applyUndo, applyRedo])

  // Wrap onNodesChange to snapshot before drag-end and node removal
  const wrappedOnNodesChange = useCallback((changes: NodeChange[]) => {
    const hasDragEnd = changes.some(
      (c) => c.type === 'position' && 'dragging' in c && c.dragging === false
    )
    const hasRemove = changes.some((c) => c.type === 'remove')

    if (hasDragEnd || hasRemove) {
      history.pushSnapshot()
    }

    boardState.onNodesChange(changes)
  }, [boardState, history])

  // Wrap onEdgesChange to snapshot before edge removal
  const wrappedOnEdgesChange = useCallback((changes: EdgeChange[]) => {
    const hasRemove = changes.some((c) => c.type === 'remove')
    if (hasRemove) {
      history.pushSnapshot()
    }
    boardState.onEdgesChange(changes)
  }, [boardState, history])

  // Wrap methods that create/modify board elements to snapshot before
  const wrappedOnConnect = useCallback((...args: Parameters<typeof boardState.onConnect>) => {
    history.pushSnapshot()
    boardState.onConnect(...args)
  }, [boardState, history])

  const wrappedBringToFront = useCallback((nodeId: string) => {
    history.pushSnapshot()
    boardState.bringToFront(nodeId)
  }, [boardState, history])

  const wrappedSendToBack = useCallback((nodeId: string) => {
    history.pushSnapshot()
    boardState.sendToBack(nodeId)
  }, [boardState, history])

  const wrappedBringForward = useCallback((nodeId: string) => {
    history.pushSnapshot()
    boardState.bringForward(nodeId)
  }, [boardState, history])

  const wrappedSendBackward = useCallback((nodeId: string) => {
    history.pushSnapshot()
    boardState.sendBackward(nodeId)
  }, [boardState, history])

  const wrappedUpdateEdgeDirection = useCallback((edgeId: string, direction: EdgeArrowDirection) => {
    history.pushSnapshot()
    boardState.updateEdgeDirection(edgeId, direction)
  }, [boardState, history])

  const wrappedExplodeHypothesis = useCallback((nodeId: string) => {
    history.pushSnapshot()
    boardState.explodeHypothesisNode(nodeId)
  }, [boardState, history])

  // Reset board selection when investigation changes so we don't keep
  // a stale board ID from a different investigation.
  useEffect(() => {
    setSelectedBoardId(null)
    setLoadingBoards(true)
    window.electronAPI.listBoards(investigationId).then((b) => {
      setBoards(b)
      if (b.length > 0) {
        setSelectedBoardId(b[0].id)
      }
    }).finally(() => setLoadingBoards(false))
  }, [investigationId])

  async function handleCreateBoard() {
    const board = await window.electronAPI.createBoard(investigationId)
    setBoards((prev) => [...prev, board])
    setSelectedBoardId(board.id)
  }

  async function handleDeleteBoard(boardId: string) {
    await window.electronAPI.deleteBoard(boardId)
    setBoards((prev) => {
      const next = prev.filter((b) => b.id !== boardId)
      if (selectedBoardId === boardId) {
        setSelectedBoardId(next.length > 0 ? next[0].id : null)
      }
      return next
    })
  }

  async function handleRenameBoard(boardId: string, name: string) {
    const updated = await window.electronAPI.renameBoard(boardId, name)
    setBoards((prev) => prev.map((b) => (b.id === boardId ? updated : b)))
  }

  function handleDropEntry(entryId: string, position: { x: number; y: number }) {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return
    history.pushSnapshot()
    boardState.addEntryNode(entry, position)
  }

  function handleAddTextBox() {
    history.pushSnapshot()
    boardState.addTextBoxNode({ x: 200, y: 200 })
  }

  function handleAddImage(imagePath: string) {
    history.pushSnapshot()
    boardState.addImageNode(imagePath, { x: 200, y: 200 })
  }

  function handleAddShape(shape: ShapeKind) {
    history.pushSnapshot()
    boardState.addShapeNode(shape, { x: 200, y: 200 })
  }

  if (loadingBoards) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Loading…</div>
    )
  }

  if (boards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500 text-sm">No boards yet</p>
        <button
          onClick={handleCreateBoard}
          className="text-xs px-4 py-2 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
        >
          Create First Board
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <BoardSelector
        boards={boards}
        selectedId={selectedBoardId}
        onSelect={setSelectedBoardId}
        onCreate={handleCreateBoard}
        onDelete={handleDeleteBoard}
        onRename={handleRenameBoard}
      />
      <div className="flex-1 flex min-h-0">
        {selectedBoardId && !boardState.loading ? (
          <BoardCanvas
            nodes={boardState.nodes}
            edges={boardState.edges}
            viewport={boardState.viewport}
            onNodesChange={wrappedOnNodesChange}
            onEdgesChange={wrappedOnEdgesChange}
            onConnect={wrappedOnConnect}
            onViewportChange={boardState.onViewportChange}
            onDropEntry={handleDropEntry}
            onAddTextBox={handleAddTextBox}
            onUpdateTextBox={boardState.updateTextBoxNode}
            onExplodeHypothesis={wrappedExplodeHypothesis}
            onUpdateShapeLabel={boardState.updateShapeLabel}
            onBringToFront={wrappedBringToFront}
            onSendToBack={wrappedSendToBack}
            onBringForward={wrappedBringForward}
            onSendBackward={wrappedSendBackward}
            onUpdateEdgeDirection={wrappedUpdateEdgeDirection}
            allEntries={entries}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            Loading board…
          </div>
        )}
        <BoardSidebar
          entries={entries}
          onAddTextBox={handleAddTextBox}
          onAddImage={handleAddImage}
          onAddShape={handleAddShape}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />
      </div>
    </div>
  )
}
