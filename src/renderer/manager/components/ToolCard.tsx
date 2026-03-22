import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Tool, ToolFolder } from '@shared/ipc-types'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  tool: Tool
  depth?: number
  folders?: ToolFolder[]
  isSelected?: boolean
  onClick?: (e: React.MouseEvent) => void
  onEdit: () => void
  onDelete: () => void
  onMoveToFolder?: (folderId: string | null) => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  dropPosition?: 'before' | 'after'
}

export function ToolCard({ tool, depth = 0, folders = [], isSelected, onClick, onEdit, onDelete, onMoveToFolder, onDragStart, onDragOver, onDragLeave, onDrop, dropPosition }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!menuOpen || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? 120
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= menuHeight + 4 ? rect.bottom + 4 : rect.top - menuHeight - 4
    setMenuPos({ top, left: rect.right - 160 })
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
        setShowMoveMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // Determine if submenu should render to the left (when near right edge)
  const submenuLeft = menuPos ? (menuPos.left + 320 + 8 > window.innerWidth) : false

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
        className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors group overflow-hidden cursor-pointer ${
          isSelected
            ? 'bg-indigo-500/15 border-indigo-500/50'
            : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600/60'
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dropPosition === 'before' && (
          <div className="absolute top-0 left-2 right-2 h-0.5 bg-indigo-500 rounded-full -translate-y-px" />
        )}
        {dropPosition === 'after' && (
          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-500 rounded-full translate-y-px" />
        )}
        {/* Type icon */}
        <span className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs ${
          tool.tool_type === 'link' ? 'text-blue-400' : tool.tool_type === 'function' ? 'text-emerald-400' : tool.tool_type === 'content' ? 'text-purple-400' : tool.tool_type === 'reference' ? 'text-cyan-400' : 'text-amber-400'
        }`}>
          {tool.tool_type === 'link' ? '↗' : tool.tool_type === 'function' ? '⚡' : tool.tool_type === 'content' ? '📖' : tool.tool_type === 'reference' ? '📋' : '⌨'}
        </span>

        {/* Content – single row */}
        <span className="text-xs font-medium text-gray-100 truncate min-w-0 flex-shrink-0 max-w-[50%]">{tool.name}</span>
        <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0 rounded leading-4
          ${tool.tool_type === 'link'
            ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40'
            : tool.tool_type === 'function'
            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40'
            : tool.tool_type === 'content'
            ? 'bg-purple-900/30 text-purple-400 border border-purple-800/40'
            : tool.tool_type === 'reference'
            ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800/40'
            : 'bg-amber-900/30 text-amber-400 border border-amber-800/40'
          }`}
        >
          {tool.tool_type}
        </span>
        <span className="text-[11px] text-gray-500 truncate min-w-0">
          {tool.tool_type === 'function' && tool.parameters
            ? `${tool.parameters.length} param${tool.parameters.length !== 1 ? 's' : ''}`
            : tool.tool_type === 'reference'
            ? (() => { try { const arr = JSON.parse(tool.value); return `${arr.length} entr${arr.length !== 1 ? 'ies' : 'y'}` } catch { return tool.value } })()
            : tool.value}
        </span>

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
        <div className="flex-shrink-0">
          <button
            ref={btnRef}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700/60 transition-colors opacity-0 group-hover:opacity-100 text-xs"
          >
            ···
          </button>
        </div>
        {menuOpen && createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-40 py-1 rounded-lg bg-gray-700 border border-gray-600 shadow-xl"
            style={menuPos ? { top: menuPos.top, left: menuPos.left } : { visibility: 'hidden', top: 0, left: 0 }}
          >
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
                  <div className={`absolute ${submenuLeft ? 'right-full mr-1' : 'left-full ml-1'} top-0 z-[9999] w-40 py-1 rounded-lg bg-gray-700 border border-gray-600 shadow-xl max-h-48 overflow-y-auto`}>
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
          </div>,
          document.body
        )}
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
