import React, { useState, useMemo, useCallback, useEffect } from 'react'
import type { JournalEntry, EntryType } from '@shared/ipc-types'
import { getEntryTypeDefinition } from '@shared/entry-types'
import { HighlightedText } from '@shared/HighlightedText'
import { formatRelativeTime } from '@shared/format-date'

type TypeFilter = 'all' | 'finding' | 'hypothesis' | 'action'

interface Props {
  entries: JournalEntry[]
  searchTerm: string
  onSearchTermChange: (term: string) => void
  onResultClick: (entryId: string) => void
  onClose: () => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
}

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'finding', label: 'Findings' },
  { key: 'hypothesis', label: 'Hypotheses' },
  { key: 'action', label: 'Actions' }
]

const LEFT_BORDER_COLORS: Record<string, string> = {
  note: 'border-l-gray-600',
  finding: 'border-l-teal-400',
  hypothesis: 'border-l-violet-500',
  action: 'border-l-orange-400',
  tool: 'border-l-sky-400'
}

const TYPE_LABEL_COLORS: Record<string, string> = {
  note: 'text-gray-600',
  finding: 'text-teal-400',
  hypothesis: 'text-violet-400',
  action: 'text-orange-400',
  tool: 'text-sky-400'
}

export function SearchPanel({ entries, searchTerm, onSearchTermChange, onResultClick, onClose, searchInputRef }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const results = useMemo(() => {
    let filtered = entries
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((e) => e.body.toLowerCase().includes(term))
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter((e) => e.type === typeFilter)
    }
    return filtered
  }, [entries, searchTerm, typeFilter])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results.length, searchTerm, typeFilter])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault()
      onResultClick(results[selectedIndex].id)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }, [results, selectedIndex, onResultClick, onClose])

  return (
    <div className="flex flex-col flex-shrink-0 border-r border-gray-700/35 bg-gray-800/15">
      {/* Search input */}
      <div className="px-2.5 pt-2.5 pb-2 border-b border-gray-700/25">
        <div className="flex items-center gap-1.5 bg-gray-800/60 border border-indigo-500/35 rounded-lg px-2.5 py-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 flex-shrink-0">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search entries..."
            className="flex-1 text-xs bg-transparent text-gray-200 outline-none font-mono placeholder-gray-600"
          />
          <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap flex-shrink-0">
            {results.length}
          </span>
        </div>

        {/* Type filters */}
        <div className="flex gap-1 mt-1.5">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`no-drag text-[9px] px-2 py-0.5 rounded-full border transition-colors font-mono ${
                typeFilter === key
                  ? 'bg-indigo-500/12 border-indigo-500/30 text-indigo-300'
                  : 'border-gray-700/30 text-gray-600 hover:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
        {results.length === 0 && (
          <div className="flex items-center justify-center py-8 text-xs text-gray-600 font-mono">
            No results
          </div>
        )}
        {results.map((entry, i) => {
          const typeDef = getEntryTypeDefinition(entry.type)
          const isSelected = i === selectedIndex
          return (
            <button
              key={entry.id}
              onClick={() => {
                setSelectedIndex(i)
                onResultClick(entry.id)
              }}
              className={`no-drag w-full text-left px-2 py-1.5 rounded-lg border-l-[3px] ${LEFT_BORDER_COLORS[entry.type] ?? 'border-l-gray-600'} transition-all ${
                isSelected
                  ? 'bg-indigo-500/10 ring-1 ring-indigo-500/25'
                  : 'hover:bg-gray-700/35'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[9px] uppercase font-medium tracking-wide ${TYPE_LABEL_COLORS[entry.type] ?? 'text-gray-600'}`}>
                  {entry.type !== 'note' ? typeDef.label : 'note'}
                </span>
                <span className="text-[9px] text-gray-600 font-mono">
                  {formatRelativeTime(entry.created_at)}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 font-mono line-clamp-2 leading-relaxed">
                <HighlightedText text={entry.body} searchTerm={searchTerm} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer with keyboard hints */}
      <div className="flex items-center gap-3 px-2.5 py-1.5 border-t border-gray-700/20">
        <span className="text-[9px] text-gray-600 font-mono">
          <kbd className="px-1 py-0 border border-gray-700 rounded text-gray-500 bg-gray-800/30">↑↓</kbd> navigate
        </span>
        <span className="text-[9px] text-gray-600 font-mono">
          <kbd className="px-1 py-0 border border-gray-700 rounded text-gray-500 bg-gray-800/30">⏎</kbd> jump
        </span>
        <span className="text-[9px] text-gray-600 font-mono">
          <kbd className="px-1 py-0 border border-gray-700 rounded text-gray-500 bg-gray-800/30">esc</kbd> close
        </span>
      </div>
    </div>
  )
}
