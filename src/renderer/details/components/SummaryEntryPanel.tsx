import { useState } from 'react'
import type { JournalEntry, HypothesisStatus } from '@shared/ipc-types'
import { getEntryTypeDefinition, filterEntries, resolveLinkedFindings, resolveChildHypotheses, resolveParentHypotheses, HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_CLASS, HYPOTHESIS_STATUS_TEXT_CLASS } from '@shared/entry-types'
import type { Filter } from '@shared/entry-types'
import { formatDate, TIMESTAMP_OPTIONS_SHORT } from '@shared/format-date'
import { useEntryImages } from '@shared/useEntryImages'
import { FlagIcon } from '@shared/FlagIcon'

interface Props {
  entries: JournalEntry[]
  onInsert: (entry: JournalEntry) => void
  onInsertImage?: (imagePath: string) => void
}

const PANEL_FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'Findings', value: 'finding' },
  { label: 'Actions', value: 'action' },
  { label: 'Hypotheses', value: 'hypothesis' }
]

export function SummaryEntryPanel({ entries, onInsert, onInsertImage }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const filtered = filterEntries(entries, filter)

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
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
          <PanelEntry key={entry.id} entry={entry} allEntries={entries} onInsert={onInsert} onInsertImage={onInsertImage} />
        ))}
      </div>
    </div>
  )
}

function PanelEntry({
  entry,
  allEntries,
  onInsert,
  onInsertImage
}: {
  entry: JournalEntry
  allEntries: JournalEntry[]
  onInsert: (entry: JournalEntry) => void
  onInsertImage?: (imagePath: string) => void
}) {
  const typeDef = getEntryTypeDefinition(entry.type ?? 'note')
  const isTyped = entry.type !== 'note'
  const isHypothesis = entry.type === 'hypothesis'
  const status = (entry.hypothesis_status ?? 'open') as HypothesisStatus
  const linkedFindings = resolveLinkedFindings(entry, allEntries)
  const childHypotheses = resolveChildHypotheses(entry, allEntries)
  const parentHypotheses = resolveParentHypotheses(entry, allEntries)

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
          {isHypothesis && (
            <span className={`flex-shrink-0 px-1 py-0.5 rounded text-xs font-semibold ${HYPOTHESIS_STATUS_CLASS[status]}`}>
              {HYPOTHESIS_STATUS_LABEL[status]}
            </span>
          )}
          {entry.flagged && (
            <FlagIcon size={10} className="text-amber-400 flex-shrink-0" />
          )}
          <span className="text-gray-600 text-xs truncate">
            {formatDate(entry.created_at, TIMESTAMP_OPTIONS_SHORT)}
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
      {isHypothesis && parentHypotheses.length > 0 && (
        <div className="mt-1.5">
          <div className="text-gray-600 text-xs font-mono uppercase tracking-wider mb-0.5">Parent</div>
          <div className="flex flex-wrap gap-1">
            {parentHypotheses.map((p) => {
              const pStatus = (p.hypothesis_status ?? 'open') as HypothesisStatus
              return (
                <div key={p.id} className="px-1.5 py-0.5 rounded text-xs font-mono bg-violet-500/10 border border-violet-500/20 text-violet-400 truncate flex items-center gap-1">
                  <span className={`font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[pStatus]}`}>{HYPOTHESIS_STATUS_LABEL[pStatus]}</span>
                  <span className="truncate">{p.body || '(no text)'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {isHypothesis && linkedFindings.length > 0 && (
        <div className="mt-1.5">
          <div className="text-gray-600 text-xs font-mono uppercase tracking-wider mb-0.5">Findings</div>
          <div className="space-y-0.5">
            {linkedFindings.map((f) => (
              <div key={f.id} className="px-1.5 py-0.5 rounded text-xs font-mono bg-teal-500/10 border border-teal-500/25 text-teal-300 truncate">
                {f.body || '(no text)'}
              </div>
            ))}
          </div>
        </div>
      )}
      {isHypothesis && childHypotheses.length > 0 && (
        <div className="mt-1.5">
          <div className="text-gray-600 text-xs font-mono uppercase tracking-wider mb-0.5">Child Hypotheses</div>
          <div className="flex flex-wrap gap-1">
            {childHypotheses.map((ch) => {
              const chStatus = (ch.hypothesis_status ?? 'open') as HypothesisStatus
              return (
                <div key={ch.id} className="px-1.5 py-0.5 rounded text-xs font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300 truncate flex items-center gap-1">
                  <span className={`font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[chStatus]}`}>{HYPOTHESIS_STATUS_LABEL[chStatus]}</span>
                  <span className="truncate">{ch.body || '(no text)'}</span>
                </div>
              )
            })}
          </div>
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
  const dataUrls = useEntryImages(imagePaths)

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {imagePaths.map((p) => (
        <div key={p} className="group/img relative">
          {dataUrls[p] ? (
            <img
              src={dataUrls[p]}
              alt=""
              className="h-12 w-12 object-cover rounded border border-gray-700"
              onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(p) }}
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
