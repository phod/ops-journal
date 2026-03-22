import React, { useState, useRef, useEffect } from 'react'
import type { Tool } from '@shared/ipc-types'

interface Props {
  tool: Tool
  onClose: () => void
}

function highlightLine(line: string, query: string) {
  if (!query) return <>{line}</>
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return <>{line}</>

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = line.split(regex)

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

function lineMatches(line: string, query: string): boolean {
  if (!query) return true
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const lower = line.toLowerCase()
  return terms.every((term) => lower.includes(term))
}

export function ContentViewer({ tool, onClose }: Props) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'c' && e.metaKey) {
      e.preventDefault()
      navigator.clipboard.writeText(tool.value)
    }
  }

  const lines = tool.value.split('\n')
  const matchCount = search ? lines.filter((line) => lineMatches(line, search)).length : 0

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
        <span className="text-purple-400 text-sm">📖</span>
        <span className="text-sm font-semibold text-gray-100 truncate">{tool.name}</span>
        <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 border border-purple-800/40">
          content
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-800/40">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter content..."
          className="no-drag w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-purple-500/60 transition-colors"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-words">
          {lines.map((line, i) => {
            const matches = lineMatches(line, search)
            return (
              <div
                key={i}
                className={`${search && !matches ? 'opacity-25' : ''} transition-opacity`}
              >
                {search && matches ? highlightLine(line, search) : line}
                {'\n'}
              </div>
            )
          })}
        </pre>
        {search && (
          <div className="mt-2 text-[10px] text-gray-500">
            {matchCount} matching line{matchCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-800/40 flex items-center gap-3">
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">esc</kbd> back
        </span>
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">⌘C</kbd> copy all
        </span>
      </div>
    </div>
  )
}
