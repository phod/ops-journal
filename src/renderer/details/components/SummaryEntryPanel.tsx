import { useState } from 'react'
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
}

const PANEL_FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Findings', value: 'finding' },
  { label: 'Actions', value: 'action' },
  { label: 'Hypotheses', value: 'hypothesis' }
]

export function SummaryEntryPanel({ entries, onInsert }: Props) {
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
          <PanelEntry key={entry.id} entry={entry} onInsert={onInsert} />
        ))}
      </div>
    </div>
  )
}

function PanelEntry({ entry, onInsert }: { entry: JournalEntry; onInsert: (entry: JournalEntry) => void }) {
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
      {!entry.body && entry.image_paths.length > 0 && (
        <div className="text-gray-500 italic">
          {entry.image_paths.length} image{entry.image_paths.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
