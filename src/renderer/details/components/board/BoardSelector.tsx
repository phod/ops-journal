import { useState, useRef, useEffect } from 'react'
import type { RumourBoard } from '@shared/board-types'

interface Props {
  boards: RumourBoard[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}

export function BoardSelector({ boards, selectedId, onSelect, onCreate, onDelete, onRename }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renamingId])

  function startRename(board: RumourBoard) {
    setRenamingId(board.id)
    setRenameValue(board.name)
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setRenamingId(null)
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-700/50 bg-gray-800/30 overflow-x-auto flex-shrink-0">
      {boards.map((board) => (
        <div key={board.id} className="flex items-center group flex-shrink-0">
          {renamingId === board.id ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              className="text-xs px-2 py-1 rounded bg-gray-700 border border-blue-500 text-gray-100 focus:outline-none w-32"
            />
          ) : (
            <button
              onClick={() => onSelect(board.id)}
              onDoubleClick={() => startRename(board)}
              title="Double-click to rename"
              className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                selectedId === board.id
                  ? 'bg-gray-700 text-gray-100 border border-gray-600'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {board.name}
            </button>
          )}
          {selectedId === board.id && (
            <button
              onClick={() => {
                if (confirm(`Delete board "${board.name}"?`)) onDelete(board.id)
              }}
              className="ml-0.5 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs px-1"
              title="Delete board"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onCreate}
        title="New board"
        className="text-xs px-2 py-1 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
      >
        + New
      </button>
    </div>
  )
}
