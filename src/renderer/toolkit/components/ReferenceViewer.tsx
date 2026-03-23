import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { Tool } from '@shared/ipc-types'

interface Props {
  tool: Tool
  onClose: () => void
}

interface ReferenceEntry {
  key: string
  value: string
}

function highlightText(text: string, query: string) {
  if (!query) return <>{text}</>
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return <>{text}</>

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="text-indigo-300 font-semibold">{part}</span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  )
}

function entryMatches(entry: ReferenceEntry, query: string): boolean {
  if (!query) return true
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const combined = (entry.key + ' ' + entry.value).toLowerCase()
  return terms.every((term) => combined.includes(term))
}

export function ReferenceViewer({ tool, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const entries: ReferenceEntry[] = (() => {
    try {
      return JSON.parse(tool.value) as ReferenceEntry[]
    } catch {
      return []
    }
  })()

  const matchingIndices = entries
    .map((entry, i) => entryMatches(entry, search) ? i : -1)
    .filter((i) => i !== -1)

  const matchCount = matchingIndices.length

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Scroll selected row into view
  useEffect(() => {
    if (!listRef.current) return
    const selectedRow = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | undefined
    selectedRow?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const getSelectedEntry = useCallback(() => {
    if (search) {
      const realIndex = matchingIndices[selectedIndex]
      return realIndex !== undefined ? entries[realIndex] : undefined
    }
    return entries[selectedIndex]
  }, [search, matchingIndices, selectedIndex, entries])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const max = search ? matchCount - 1 : entries.length - 1
      setSelectedIndex((i) => Math.min(i + 1, max))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'c' && e.metaKey && e.shiftKey) {
      e.preventDefault()
      const entry = getSelectedEntry()
      if (entry) navigator.clipboard.writeText(entry.key)
    } else if (e.key === 'c' && e.metaKey) {
      // Allow native copy when user has selected text
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) return
      e.preventDefault()
      const entry = getSelectedEntry()
      if (entry) navigator.clipboard.writeText(entry.value)
    }
  }

  function handleRowClick(index: number) {
    if (search) {
      const pos = matchingIndices.indexOf(index)
      if (pos !== -1) setSelectedIndex(pos)
    } else {
      setSelectedIndex(index)
    }
  }

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/60 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="no-drag text-gray-400 hover:text-gray-200 transition-colors text-sm"
        >
          ←
        </button>
        <span className="text-cyan-400 text-sm">📋</span>
        <span className="text-sm font-semibold text-gray-100 truncate">{tool.name}</span>
        <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400 border border-cyan-800/40">
          reference
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-800/40">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search keys or values..."
          className="no-drag w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-cyan-500/60 transition-colors"
        />
      </div>

      {/* Entries */}
      <div className="flex-1 min-h-0 overflow-y-auto select-text" ref={listRef}>
        <div className="px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-1 px-1">
            <span className="max-w-[45%] flex-shrink-0">Key</span>
            <span className="w-4"></span>
            <span>Value</span>
          </div>
        </div>
        <div className="px-4 space-y-0">
          {entries.map((entry, i) => {
            const matches = entryMatches(entry, search)
            const isSelected = search
              ? matchingIndices[selectedIndex] === i
              : selectedIndex === i
            return (
              <div
                key={i}
                data-selected={isSelected ? 'true' : undefined}
                onClick={() => handleRowClick(i)}
                className={`group flex items-center gap-3 px-1 py-1.5 rounded transition-opacity cursor-pointer ${
                  search && !matches ? 'opacity-25' : ''
                } ${isSelected ? 'bg-indigo-600/20 border border-indigo-500/30' : search && matches ? 'bg-cyan-900/10' : ''} ${
                  i > 0 ? 'border-t border-gray-800/30' : ''
                }`}
              >
                <span className="max-w-[45%] flex-shrink-0 min-w-0 text-xs text-cyan-300 font-mono truncate">
                  {search && matches ? highlightText(entry.key, search) : entry.key}
                </span>
                <span className="text-gray-600 text-xs flex-shrink-0">→</span>
                <span className="flex-1 min-w-0 text-xs text-gray-200 truncate">
                  {search && matches ? highlightText(entry.value, search) : entry.value}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(entry.value)
                  }}
                  className="no-drag flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-gray-400 hover:text-gray-200 p-0.5"
                  data-tooltip="Copy value"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                    <path d="M10.5 5.5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Match count */}
      {search && (
        <div className="px-4 py-1 text-[10px] text-gray-500 border-t border-gray-800/40">
          {matchCount} matching entr{matchCount !== 1 ? 'ies' : 'y'}
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-800/40 flex items-center gap-3">
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">esc</kbd> back
        </span>
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">⌘C</kbd> copy value
        </span>
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">⌘⇧C</kbd> copy key
        </span>
      </div>
    </div>
  )
}
