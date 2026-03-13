import { useEffect, useRef, useState } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { formatDate } from '@shared/format-date'
import { getEntryTypeDefinition, ENTRY_TYPES } from '@shared/entry-types'

interface Props {
  entries: JournalEntry[]
  onEntryUpdated?: (entry: JournalEntry) => void
}

const TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}

function DetailsEntryRow({ entry, onEntryUpdated }: { entry: JournalEntry; onEntryUpdated?: (entry: JournalEntry) => void }): JSX.Element {
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({})
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const typeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    for (const path of entry.image_paths) {
      if (!imageDataUrls[path]) {
        window.electronAPI
          .getEntryImage(path)
          .then((dataUrl) => {
            setImageDataUrls((prev) => ({ ...prev, [path]: dataUrl }))
          })
          .catch(() => {})
      }
    }
  }, [entry.image_paths])

  useEffect(() => {
    if (!showTypeMenu) return
    const handler = (e: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTypeMenu])

  const changeType = async (newType: import('@shared/ipc-types').EntryType) => {
    setShowTypeMenu(false)
    if (newType === entry.type) return
    try {
      const updated = await window.electronAPI.updateEntry(entry.id, entry.body, undefined, newType)
      onEntryUpdated?.(updated)
    } catch (err) {
      console.error('[details] Failed to change entry type:', err)
    }
  }

  const typeDef = getEntryTypeDefinition(entry.type ?? 'note')
  const isTyped = entry.type && entry.type !== 'note'

  const cardClass = isTyped
    ? `group border-l-4 ${typeDef.leftBorderClass} ${typeDef.cardBgClass} ${typeDef.cardBorderClass} rounded-lg px-4 py-3 border`
    : 'group bg-gray-800/60 rounded-lg px-4 py-3 border border-gray-700/50'

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-1.5">
        {formatDate(entry.created_at, TIMESTAMP_OPTIONS)}
        <div className="relative" ref={typeMenuRef}>
          {isTyped ? (
            <button
              onClick={() => setShowTypeMenu((v) => !v)}
              className={`no-drag px-1.5 py-0.5 rounded text-xs ${typeDef.tagBgClass} ${typeDef.tagTextClass} cursor-pointer`}
              title="Change entry type"
            >
              {typeDef.label.toUpperCase()}
            </button>
          ) : (
            <button
              onClick={() => setShowTypeMenu((v) => !v)}
              className="no-drag opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-gray-400 px-1"
              title="Set entry type"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </button>
          )}
          {showTypeMenu && (
            <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[120px] shadow-lg">
              {ENTRY_TYPES.map((def) => (
                <button
                  key={def.type}
                  onMouseDown={(e) => { e.preventDefault(); changeType(def.type) }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors hover:bg-gray-700 ${
                    entry.type === def.type ? 'text-gray-100' : 'text-gray-400'
                  }`}
                >
                  {def.type !== 'note' ? (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${def.tagBgClass} ${def.tagTextClass}`}>
                      {def.label.toUpperCase()}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-400">NOTE</span>
                  )}
                  {entry.type === def.type && <span className="ml-auto text-gray-500">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {entry.body && (
        <div className="text-gray-100 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
          {entry.body}
        </div>
      )}
      {entry.image_paths.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${entry.body ? 'mt-1.5' : ''}`}>
          {entry.image_paths.map((path) => (
            <img
              key={path}
              src={imageDataUrls[path]}
              alt="Attached"
              onClick={() => setExpandedPath(expandedPath === path ? null : path)}
              className={`rounded border border-gray-600 object-contain cursor-pointer transition-all ${
                expandedPath === path ? 'max-h-none w-full' : 'max-h-40'
              }`}
              title={expandedPath === path ? 'Click to collapse' : 'Click to expand'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DetailsEntryList({ entries, onEntryUpdated }: Props): JSX.Element {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm font-mono">
        No entries yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <DetailsEntryRow key={entry.id} entry={entry} onEntryUpdated={onEntryUpdated} />
      ))}
    </div>
  )
}
