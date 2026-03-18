import { useEffect, useState } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import type { RumourBoard, ShapeKind } from '@shared/board-types'
import { BoardSelector } from './BoardSelector'
import { BoardCanvas } from './BoardCanvas'
import { BoardSidebar } from './BoardSidebar'
import { useBoardState } from './hooks/useBoardState'
import { useBoardAutoSave } from './hooks/useBoardAutoSave'

interface Props {
  investigationId: string
  entries: JournalEntry[]
}

export function RumourBoardView({ investigationId, entries }: Props) {
  const [boards, setBoards] = useState<RumourBoard[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [loadingBoards, setLoadingBoards] = useState(true)

  const boardState = useBoardState(selectedBoardId, entries)

  useBoardAutoSave({
    boardId: selectedBoardId,
    isDirty: boardState.isDirty,
    setDirty: boardState.setDirty,
    toBoardNodes: boardState.toBoardNodes,
    toBoardEdges: boardState.toBoardEdges,
    toBoardViewport: boardState.toBoardViewport
  })

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
    boardState.addEntryNode(entry, position)
  }

  function handleAddTextBox() {
    // Add in center-ish area
    boardState.addTextBoxNode({ x: 200, y: 200 })
  }

  function handleAddImage(imagePath: string) {
    boardState.addImageNode(imagePath, { x: 200, y: 200 })
  }

  function handleAddShape(shape: ShapeKind) {
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
            onNodesChange={boardState.onNodesChange}
            onEdgesChange={boardState.onEdgesChange}
            onConnect={boardState.onConnect}
            onViewportChange={boardState.onViewportChange}
            onDropEntry={handleDropEntry}
            onAddTextBox={handleAddTextBox}
            onUpdateTextBox={boardState.updateTextBoxNode}
            onExplodeHypothesis={boardState.explodeHypothesisNode}
            onUpdateShapeLabel={boardState.updateShapeLabel}
            onBringToFront={boardState.bringToFront}
            onSendToBack={boardState.sendToBack}
            onBringForward={boardState.bringForward}
            onSendBackward={boardState.sendBackward}
            onUpdateEdgeDirection={boardState.updateEdgeDirection}
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
        />
      </div>
    </div>
  )
}
