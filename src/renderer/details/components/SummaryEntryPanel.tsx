import { useState, useEffect } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { getEntryTypeDefinition, filterEntries } from '@shared/entry-types'
import type { Filter } from '@shared/entry-types'
import { formatDate } from '@shared/format-date'

const TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}

interface Props {
  entries: JournalEntry[]
  onInsert: (entry: JournalEntry) => void
  onInsertImage?: (imagePath: string) => void
}

const PANEL_FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Findings', value: 'finding' },
  { label: 'Actions', value: 'action' },
  { label: 'Hypotheses', value: 'hypothesis' }
]

export function SummaryEntryPanel({ entries, onInsert, onInsertImage }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const filtered = filterEntries(entries, filter)

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="text-xs text-gray-500 font-mono uppercase tracking-wider px-1">
        Entries
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        {PANEL_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
              filter === value
                ? 'bg-gray-600 text-gray-100'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {filtered.length === 0 && (
          <div className="text-gray-600 text-xs font-mono py-4 text-center">
            No entries.
          </div>
        )}
        {filtered.map((entry) => (
          <PanelEntry key={entry.id} entry={entry} onInsert={onInsert} onInsertImage={onInsertImage} />
        ))}
      </div>
    </div>
  )
}

function PanelEntry({
  entry,
  onInsert,
  onInsertImage
}: {
  entry: JournalEntry
  onInsert: (entry: JournalEntry) => void
  onInsertImage?: (imagePath: string) => void
}) {
  const typeDef = getEntryTypeDefinition(entry.type ?? 'note')
  const isTyped = entry.type !== 'note'

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/x-ops-entry-ref', entry.id)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group rounded-lg px-2.5 py-2 border text-xs font-mono cursor-grab active:cursor-grabbing transition-colors ${
        isTyped
          ? `border-l-4 ${typeDef.leftBorderClass} ${typeDef.cardBgClass} ${typeDef.cardBorderClass}`
          : 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-800'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isTyped && (
            <span className={`flex-shrink-0 px-1 py-0.5 rounded text-xs ${typeDef.tagBgClass} ${typeDef.tagTextClass}`}>
              {typeDef.label.toUpperCase()}
            </span>
          )}
          <span className="text-gray-600 text-xs truncate">
            {formatDate(entry.created_at, TIMESTAMP_OPTIONS)}
          </span>
        </div>
        <button
          onClick={() => onInsert(entry)}
          onMouseDown={(e) => e.preventDefault()}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
          title="Insert at cursor"
        >
          Insert
        </button>
      </div>
      {entry.body && (
        <div className="text-gray-300 line-clamp-2 leading-relaxed break-words">
          {entry.body}
        </div>
      )}
      {entry.image_paths.length > 0 && onInsertImage && (
        <EntryImageStrip imagePaths={entry.image_paths} onInsertImage={onInsertImage} />
      )}
      {!entry.body && entry.image_paths.length === 0 && (
        <div className="text-gray-500 italic">(empty)</div>
      )}
    </div>
  )
}

function EntryImageStrip({
  imagePaths,
  onInsertImage
}: {
  imagePaths: string[]
  onInsertImage: (imagePath: string) => void
}) {
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    for (const p of imagePaths) {
      window.electronAPI.getEntryImage(p).then((url) => {
        setDataUrls((prev) => ({ ...prev, [p]: url }))
      })
    }
  }, [imagePaths])

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {imagePaths.map((p) => (
        <div key={p} className="group/img relative">
          {dataUrls[p] ? (
            <img
              src={dataUrls[p]}
              alt=""
              className="h-12 w-12 object-cover rounded border border-gray-700"
            />
          ) : (
            <div className="h-12 w-12 rounded border border-gray-700 bg-gray-800" />
          )}
          <button
            onClick={() => onInsertImage(p)}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-0 flex items-center justify-center rounded opacity-0 group-hover/img:opacity-100 bg-black/60 text-white text-xs font-medium transition-opacity"
            title="Insert image"
          >
            Insert
          </button>
        </div>
      ))}
    </div>
  )
}
