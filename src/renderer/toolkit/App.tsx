import { useState, useEffect, useRef, useCallback } from 'react'
import type { Tool } from '@shared/ipc-types'
import { ToolRow } from './components/ToolRow'

export default function App() {
  const [tools, setTools] = useState<Tool[]>([])
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [opaqueOverlay, setOpaqueOverlay] = useState(false)

  const loadTools = useCallback(async () => {
    const list = await window.electronAPI.listTools()
    setTools(list)
  }, [])

  useEffect(() => {
    loadTools()
  }, [loadTools])

  useEffect(() => {
    window.electronAPI.getOpaqueOverlay().then(setOpaqueOverlay)
    return window.electronAPI.onOpaqueOverlayChanged(setOpaqueOverlay)
  }, [])

  useEffect(() => {
    return window.electronAPI.onToolsChanged((updatedTools) => {
      setTools(updatedTools)
    })
  }, [])

  // Auto-focus search on window focus
  useEffect(() => {
    const handleFocus = () => {
      setSearch('')
      setSelectedIndex(0)
      searchRef.current?.focus()
    }
    window.addEventListener('focus', handleFocus)
    // Focus on mount
    searchRef.current?.focus()
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const filtered = tools.filter((tool) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  async function executeTool(tool: Tool) {
    await window.electronAPI.executeTool(tool.id)
    if (tool.tool_type === 'link') {
      await window.electronAPI.hideToolkitOverlay()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        executeTool(filtered[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      window.electronAPI.hideToolkitOverlay()
    }
  }

  return (
    <div
      className={`h-screen flex flex-col rounded-xl ${opaqueOverlay ? 'bg-gray-900/95' : 'bg-gray-900'} border border-gray-700/60 shadow-2xl overflow-hidden backdrop-blur-sm`}
      onKeyDown={handleKeyDown}
    >
      {/* Drag handle header */}
      <div className="drag-handle flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-xs font-semibold text-gray-300 tracking-wide">Toolkit</span>
        </div>
        <span className="text-[10px] text-gray-600 font-mono">{filtered.length} tool{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-gray-800/40">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
          className="no-drag w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-indigo-500/60 transition-colors"
        />
      </div>

      {/* Tool list */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            {tools.length === 0 ? 'No tools yet — add some in the manager' : 'No matching tools'}
          </div>
        ) : (
          filtered.map((tool, i) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              search={search}
              selected={i === selectedIndex}
              onClick={() => executeTool(tool)}
              onMouseEnter={() => setSelectedIndex(i)}
            />
          ))
        )}
      </div>

      {/* Footer hints */}
      <div className="px-3 py-1.5 border-t border-gray-800/40 flex items-center gap-3">
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">↑↓</kbd> navigate
        </span>
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">↵</kbd> execute
        </span>
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">esc</kbd> close
        </span>
      </div>
    </div>
  )
}
