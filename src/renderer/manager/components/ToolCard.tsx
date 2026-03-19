import { useState, useRef, useEffect } from 'react'
import type { Tool } from '@shared/ipc-types'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  tool: Tool
  onEdit: () => void
  onDelete: () => void
}

export function ToolCard({ tool, onEdit, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:border-gray-600/60 transition-colors group">
        {/* Type icon */}
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-700/60 border border-gray-600/40 flex items-center justify-center text-sm">
          {tool.tool_type === 'link' ? (
            <span className="text-blue-400">↗</span>
          ) : (
            <span className="text-amber-400">⌨</span>
          )}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-100 truncate">{tool.name}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded
              ${tool.tool_type === 'link'
                ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40'
                : 'bg-amber-900/30 text-amber-400 border border-amber-800/40'
              }`}
            >
              {tool.tool_type}
            </span>
          </div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{tool.value}</div>
          {tool.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {tool.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-400 border border-gray-600/40">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Overflow menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700/60 transition-colors opacity-0 group-hover:opacity-100"
          >
            ···
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-32 py-1 rounded-lg bg-gray-700 border border-gray-600 shadow-xl">
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 transition-colors"
              >
                Edit
              </button>
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
