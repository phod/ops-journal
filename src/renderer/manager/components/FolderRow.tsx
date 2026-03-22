import { useState, useRef, useEffect } from 'react'
import type { ToolFolder } from '@shared/ipc-types'
import { MAX_TOOL_FOLDER_DEPTH } from '@shared/ipc-types'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  folder: ToolFolder
  depth: number
  toolCount: number
  expanded: boolean
  onToggle: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onAddTool: () => void
  onAddSubFolder: () => void
  children: React.ReactNode
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
}

export function FolderRow({
  folder, depth, toolCount, expanded, onToggle, onRename, onDelete,
  onAddTool, onAddSubFolder, children,
  onDragStart, onDragOver, onDrop, onDragLeave
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(folder.name)
  const [dragOver, setDragOver] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renaming])

  function commitRename() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== folder.name) {
      onRename(trimmed)
    }
    setRenaming(false)
    setRenameValue(folder.name)
  }

  function handleDragOverLocal(e: React.DragEvent) {
    setDragOver(true)
    onDragOver(e)
  }

  function handleDragLeaveLocal(e: React.DragEvent) {
    setDragOver(false)
    onDragLeave(e)
  }

  function handleDropLocal(e: React.DragEvent) {
    setDragOver(false)
    onDrop(e)
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group
          ${dragOver ? 'bg-indigo-500/20 border border-indigo-500/40' : 'hover:bg-gray-800/50 border border-transparent'}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={onToggle}
        draggable
        onDragStart={onDragStart}
        onDragOver={handleDragOverLocal}
        onDrop={handleDropLocal}
        onDragLeave={handleDragLeaveLocal}
      >
        {/* Chevron */}
        <span className={`text-[10px] text-gray-500 transition-transform flex-shrink-0 w-3 ${expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>

        {/* Folder icon */}
        <span className="text-xs text-yellow-500/80 flex-shrink-0">
          {expanded ? '📂' : '📁'}
        </span>

        {/* Name or rename input */}
        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setRenaming(false); setRenameValue(folder.name) }
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 border border-indigo-500/60 rounded px-1.5 py-0.5 text-xs text-gray-100 outline-none w-40"
          />
        ) : (
          <span
            className="text-xs font-medium text-gray-200 truncate"
            onDoubleClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameValue(folder.name) }}
          >
            {folder.name}
          </span>
        )}

        {/* Item count badge */}
        <span className="text-[10px] text-gray-500 flex-shrink-0">
          {toolCount}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Overflow menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700/60 transition-colors opacity-0 group-hover:opacity-100 text-[10px]"
          >
            ···
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-40 py-1 rounded-lg bg-gray-700 border border-gray-600 shadow-xl">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setRenaming(true); setRenameValue(folder.name) }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 transition-colors"
              >
                Rename
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAddTool() }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 transition-colors"
              >
                Add Tool
              </button>
              {depth + 1 < MAX_TOOL_FOLDER_DEPTH && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAddSubFolder() }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 transition-colors"
                >
                  Add Sub-folder
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setConfirmDelete(true) }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-600 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children (only visible when expanded) */}
      {expanded && children}

      {confirmDelete && (
        <ConfirmDialog
          data-tooltip="Delete Folder"
          message={`Delete "${folder.name}"? Items inside will be moved to the parent folder.`}
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDelete() }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
