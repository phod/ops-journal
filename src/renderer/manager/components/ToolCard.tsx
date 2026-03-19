import { useState, useRef, useEffect } from 'react'
import type { Tool, ToolFolder } from '@shared/ipc-types'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  tool: Tool
  depth?: number
  folders?: ToolFolder[]
  onEdit: () => void
  onDelete: () => void
  onMoveToFolder?: (folderId: string | null) => void
  onDragStart?: (e: React.DragEvent) => void
}

export function ToolCard({ tool, depth = 0, folders = [], onEdit, onDelete, onMoveToFolder, onDragStart }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setShowMoveMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // Build move-to options: root + all folders except current
  const moveOptions: { id: string | null; name: string }[] = []
  if (tool.folder_id !== null) {
    moveOptions.push({ id: null, name: 'Root' })
  }
  for (const f of folders) {
    if (f.id !== tool.folder_id) {
      moveOptions.push({ id: f.id, name: f.name })
    }
  }

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600/60 transition-colors group"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
      >
        {/* Type icon */}
        <span className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs ${
          tool.tool_type === 'link' ? 'text-blue-400' : 'text-amber-400'
        }`}>
          {tool.tool_type === 'link' ? '↗' : '⌨'}
        </span>

        {/* Content – single row */}
        <span className="text-xs font-medium text-gray-100 truncate">{tool.name}</span>
        <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0 rounded leading-4
          ${tool.tool_type === 'link'
            ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40'
            : 'bg-amber-900/30 text-amber-400 border border-amber-800/40'
          }`}
        >
          {tool.tool_type}
        </span>
        <span className="text-[11px] text-gray-500 truncate">{tool.value}</span>

        {tool.tags.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {tool.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 rounded bg-gray-700/60 text-gray-400 border border-gray-600/40 leading-4">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Overflow menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700/60 transition-colors opacity-0 group-hover:opacity-100 text-xs"
          >
            ···
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-40 py-1 rounded-lg bg-gray-700 border border-gray-600 shadow-xl">
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 transition-colors"
              >
                Edit
              </button>
              {onMoveToFolder && moveOptions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowMoveMenu(!showMoveMenu)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 transition-colors flex items-center justify-between"
                  >
                    Move to…
                    <span className="text-[10px] text-gray-500">▶</span>
                  </button>
                  {showMoveMenu && (
                    <div className="absolute left-full top-0 ml-1 z-30 w-40 py-1 rounded-lg bg-gray-700 border border-gray-600 shadow-xl max-h-48 overflow-y-auto">
                      {moveOptions.map((opt) => (
                        <button
                          key={opt.id ?? '__root__'}
                          onClick={() => { setMenuOpen(false); setShowMoveMenu(false); onMoveToFolder(opt.id) }}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 transition-colors truncate"
                        >
                          {opt.id === null ? '/ Root' : `📁 ${opt.name}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-600 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Tool"
          message={`Are you sure you want to delete "${tool.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDelete() }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
