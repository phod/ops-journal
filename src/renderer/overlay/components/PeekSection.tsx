import React from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { useEntryImages } from '@shared/useEntryImages'
import { useEntryRelationships } from '@shared/useEntryRelationships'
import { HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_TEXT_CLASS } from '@shared/entry-types'
import { formatRelativeTime } from '@shared/format-date'
import { scrollToEntry } from '@shared/scroll-to-entry'

interface Props {
  entry: JournalEntry
  allEntries: JournalEntry[]
  onScrollToEntry: (id: string) => void
}

const TYPE_COLORS: Record<string, { border: string; borderLeft: string; bg: string; dot: string }> = {
  finding: {
    border: 'border-teal-500/15',
    borderLeft: 'border-l-teal-500',
    bg: 'bg-teal-500/[0.03]',
    dot: 'bg-teal-400'
  },
  hypothesis: {
    border: 'border-violet-500/15',
    borderLeft: 'border-l-violet-500',
    bg: 'bg-violet-500/[0.03]',
    dot: 'bg-violet-500'
  },
  action: {
    border: 'border-orange-500/15',
    borderLeft: 'border-l-orange-500',
    bg: 'bg-orange-500/[0.03]',
    dot: 'bg-orange-400'
  },
  tool: {
    border: 'border-sky-500/15',
    borderLeft: 'border-l-sky-500',
    bg: 'bg-sky-500/[0.03]',
    dot: 'bg-sky-400'
  },
  note: {
    border: 'border-gray-500/15',
    borderLeft: 'border-l-gray-500',
    bg: 'bg-gray-500/[0.03]',
    dot: 'bg-gray-400'
  },
  flagged: {
    border: 'border-amber-500/15',
    borderLeft: 'border-l-amber-500',
    bg: 'bg-amber-500/[0.03]',
    dot: 'bg-amber-400'
  }
}

function getColors(type: string) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.note
}

const LINK_DOT_COLOR: Record<string, string> = {
  hypothesis: 'bg-violet-500',
  finding: 'bg-teal-400',
  action: 'bg-orange-400'
}

export function PeekSection({ entry, allEntries, onScrollToEntry }: Props) {
  const imageDataUrls = useEntryImages(entry.image_paths)
  const { linkedFindings, linkedActions, linkedChildHypotheses, parentHypotheses, linkedHypotheses } = useEntryRelationships(entry, allEntries)
  const colors = getColors(entry.type)

  const hasImages = entry.image_paths.length > 0
  const allLinked = [
    ...linkedFindings.map((e) => ({ ...e, linkType: 'finding' as const })),
    ...linkedActions.map((e) => ({ ...e, linkType: 'action' as const })),
    ...linkedChildHypotheses.map((e) => ({ ...e, linkType: 'hypothesis' as const })),
    ...parentHypotheses.map((e) => ({ ...e, linkType: 'hypothesis' as const })),
    ...linkedHypotheses.map((e) => ({ ...e, linkType: 'hypothesis' as const }))
  ]
  const hasLinks = allLinked.length > 0

  return (
    <div className={`my-0.5 rounded-lg border ${colors.border} border-l-4 ${colors.borderLeft} ${colors.bg} overflow-hidden`}>
      {/* Full body text */}
      <div className="px-3 pt-2.5 text-xs text-gray-300 font-mono leading-relaxed">
        {entry.body || '(no text)'}
      </div>

      {/* Horizontal scrollable image strip */}
      {hasImages && (
        <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {entry.image_paths.map((path) => (
            <div
              key={path}
              className="relative flex-shrink-0 w-20 h-14 rounded overflow-hidden cursor-pointer border border-gray-700/30"
              style={{ background: '#1a1f2e' }}
              onClick={() => onScrollToEntry(entry.id)}
            >
              {/* Scanline texture overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)'
                }}
              />
              {imageDataUrls[path] && (
                <img
                  src={imageDataUrls[path]}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Linked items */}
      {hasLinks && (
        <div className="mx-2 px-2 py-2 border-t border-gray-700/15">
          <div className="text-[9px] text-gray-600 uppercase tracking-wide mb-1.5">
            Linked ({allLinked.length})
          </div>
          {allLinked.map((linked) => (
            <button
              key={linked.id}
              onClick={() => {
                onScrollToEntry(linked.id)
                scrollToEntry(linked.id)
              }}
              className="no-drag flex items-center gap-1.5 w-full px-1.5 py-1 rounded text-left hover:bg-gray-700/20 transition-colors"
            >
              <div className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${LINK_DOT_COLOR[linked.linkType] ?? 'bg-gray-400'}`} />
              <span className="text-[10px] text-gray-400 truncate flex-1 font-mono">
                {linked.body || '(no text)'}
              </span>
              {linked.type === 'hypothesis' && linked.hypothesis_status && (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${HYPOTHESIS_STATUS_TEXT_CLASS[linked.hypothesis_status]}`}>
                  {HYPOTHESIS_STATUS_LABEL[linked.hypothesis_status]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[9px] text-gray-600 font-mono">
          {formatRelativeTime(entry.created_at)}
        </span>
        <button
          onClick={() => {
            onScrollToEntry(entry.id)
            scrollToEntry(entry.id)
          }}
          className="no-drag text-[9px] text-gray-600 hover:text-gray-300 border border-gray-700/25 rounded px-2 py-0.5 transition-colors font-mono"
        >
          Jump to ↗
        </button>
      </div>
    </div>
  )
}
