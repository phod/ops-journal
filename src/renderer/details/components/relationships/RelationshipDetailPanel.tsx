import type { JournalEntry } from '@shared/ipc-types'
import { useEntryRelationships } from '@shared/useEntryRelationships'
import { formatDate } from '@shared/format-date'
import {
  HYPOTHESIS_STATUS_LABEL,
  HYPOTHESIS_STATUS_CLASS
} from '@shared/entry-types'

interface RelationshipDetailPanelProps {
  entry: JournalEntry
  allEntries: JournalEntry[]
  onFocusEntry: (id: string) => void
  onClose: () => void
}

function LinkedEntryItem({
  entry,
  onClick
}: {
  entry: JournalEntry
  onClick: () => void
}): JSX.Element {
  const colorMap: Record<string, string> = {
    hypothesis: 'border-l-violet-400',
    finding: 'border-l-teal-400',
    action: 'border-l-orange-400'
  }
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-1.5 rounded text-xs text-gray-300 hover:bg-gray-700/50 border-l-2 ${colorMap[entry.type] ?? 'border-l-gray-500'} transition-colors`}
    >
      <span className="line-clamp-1">{entry.body}</span>
    </button>
  )
}

function EntryGroup({
  label,
  entries,
  onFocusEntry
}: {
  label: string
  entries: JournalEntry[]
  onFocusEntry: (id: string) => void
}): JSX.Element | null {
  if (entries.length === 0) return null
  return (
    <div className="mt-3">
      <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
        {label}
      </h4>
      <div className="flex flex-col gap-1">
        {entries.map((e) => (
          <LinkedEntryItem key={e.id} entry={e} onClick={() => onFocusEntry(e.id)} />
        ))}
      </div>
    </div>
  )
}

export function RelationshipDetailPanel({
  entry,
  allEntries,
  onFocusEntry,
  onClose
}: RelationshipDetailPanelProps): JSX.Element {
  const { linkedFindings, linkedActions, linkedChildHypotheses, parentHypotheses, linkedHypotheses } =
    useEntryRelationships(entry, allEntries)

  const typeLabel =
    entry.type === 'hypothesis'
      ? 'Hypothesis'
      : entry.type === 'finding'
        ? 'Finding'
        : entry.type === 'action'
          ? 'Action'
          : entry.type

  const typeColor =
    entry.type === 'hypothesis'
      ? '#8b5cf6'
      : entry.type === 'finding'
        ? '#2dd4bf'
        : '#fb923c'

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-gray-900/95 border-l border-gray-700/40 z-20 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: typeColor }}
        >
          {typeLabel}
        </span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-xs px-1 transition-colors"
        >
          \u2715
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Status badge for hypotheses */}
        {entry.type === 'hypothesis' && entry.hypothesis_status && (
          <span
            className={`inline-block text-[10px] px-2 py-0.5 rounded font-medium mb-2 ${HYPOTHESIS_STATUS_CLASS[entry.hypothesis_status]}`}
          >
            {HYPOTHESIS_STATUS_LABEL[entry.hypothesis_status]}
          </span>
        )}

        {/* Action status */}
        {entry.type === 'action' && (
          <span className={`inline-block text-[10px] font-medium mb-2 ${entry.action_completed ? 'text-green-400' : 'text-gray-500'}`}>
            {entry.action_completed ? '\u2713 Done' : '\u25CB Open'}
          </span>
        )}

        {/* Full body text */}
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
          {entry.body}
        </p>

        {/* Timestamp */}
        <div className="text-[10px] text-gray-500 mt-2">
          {formatDate(entry.created_at)}
        </div>

        {/* Linked entries */}
        <EntryGroup label="Findings" entries={linkedFindings} onFocusEntry={onFocusEntry} />
        <EntryGroup label="Actions" entries={linkedActions} onFocusEntry={onFocusEntry} />
        <EntryGroup label="Child Hypotheses" entries={linkedChildHypotheses} onFocusEntry={onFocusEntry} />
        <EntryGroup label="Parent Hypotheses" entries={parentHypotheses} onFocusEntry={onFocusEntry} />
        <EntryGroup label="Linked Hypotheses" entries={linkedHypotheses} onFocusEntry={onFocusEntry} />
      </div>
    </div>
  )
}
