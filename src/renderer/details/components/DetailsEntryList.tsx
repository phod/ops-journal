import { useEffect, useRef, useState } from 'react'
import type { JournalEntry, EntryType, HypothesisStatus } from '@shared/ipc-types'
import { formatDate } from '@shared/format-date'
import { getEntryTypeDefinition, ENTRY_TYPES, HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_CLASS, HYPOTHESIS_STATUS_TEXT_CLASS } from '@shared/entry-types'

interface Props {
  entries: JournalEntry[]
  allEntries?: JournalEntry[]
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

function scrollToEntry(id: string) {
  document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

// Expanded inline detail card shown when clicking a finding chip on a hypothesis
function FindingDetailCard({ finding }: { finding: JournalEntry }) {
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({})
  const [expandedPath, setExpandedPath] = useState<string | null>(null)

  useEffect(() => {
    for (const path of finding.image_paths) {
      window.electronAPI.getEntryImage(path).then((url) => {
        setImageDataUrls((prev) => ({ ...prev, [path]: url }))
      }).catch(() => {})
    }
  }, [finding.image_paths])

  return (
    <div className="mt-1 p-3 bg-teal-950/40 border border-teal-500/30 rounded-lg">
      <div className="text-xs text-gray-500 font-mono mb-2">
        {formatDate(finding.created_at, TIMESTAMP_OPTIONS)}
      </div>
      {finding.body && (
        <div className="text-sm text-gray-200 font-mono whitespace-pre-wrap break-words leading-relaxed">
          {finding.body}
        </div>
      )}
      {finding.image_paths.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${finding.body ? 'mt-2' : ''}`}>
          {finding.image_paths.map((path) => (
            <img
              key={path}
              src={imageDataUrls[path]}
              alt="Attached"
              onClick={() => setExpandedPath(expandedPath === path ? null : path)}
              onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(path) }}
              className={`rounded border border-teal-500/30 object-contain cursor-pointer transition-all ${
                expandedPath === path ? 'max-h-none w-full' : 'max-h-48'
              }`}
              title={expandedPath === path ? 'Click to collapse' : 'Click to expand'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DetailsEntryRow({ entry, allEntries, onEntryUpdated }: { entry: JournalEntry; allEntries?: JournalEntry[]; onEntryUpdated?: (entry: JournalEntry) => void }): JSX.Element {
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({})
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [expandedFindingIds, setExpandedFindingIds] = useState<Set<string>>(new Set())
  const typeMenuRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!showStatusMenu) return
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showStatusMenu])

  const changeType = async (newType: EntryType) => {
    setShowTypeMenu(false)
    if (newType === entry.type) return
    try {
      const updated = await window.electronAPI.updateEntry(entry.id, entry.body, undefined, newType)
      onEntryUpdated?.(updated)
    } catch (err) {
      console.error('[details] Failed to change entry type:', err)
    }
  }

  const changeHypothesisStatus = async (status: HypothesisStatus) => {
    setShowStatusMenu(false)
    try {
      const updated = await window.electronAPI.updateHypothesisStatus(entry.id, status)
      onEntryUpdated?.(updated)
    } catch (err) {
      console.error('[details] Failed to change hypothesis status:', err)
    }
  }

  const toggleFindingExpanded = (findingId: string) => {
    setExpandedFindingIds((prev) => {
      const next = new Set(prev)
      if (next.has(findingId)) next.delete(findingId)
      else next.add(findingId)
      return next
    })
  }

  const typeDef = getEntryTypeDefinition(entry.type ?? 'note')
  const isTyped = entry.type !== 'note'
  const isHypothesis = entry.type === 'hypothesis'
  const isFinding = entry.type === 'finding'
  const isAction = entry.type === 'action'
  const status = entry.hypothesis_status ?? 'open'

  const toggleCompleted = async () => {
    try {
      const updated = await window.electronAPI.toggleActionCompleted(entry.id)
      onEntryUpdated?.(updated)
    } catch (err) {
      console.error('[details] Failed to toggle action completed:', err)
    }
  }

  const toggleFlagged = async () => {
    try {
      const updated = await window.electronAPI.toggleFlagged(entry.id)
      onEntryUpdated?.(updated)
    } catch (err) {
      console.error('[details] Failed to toggle flagged:', err)
    }
  }

  const linkedFindings = isHypothesis && allEntries
    ? (entry.linked_finding_ids ?? []).map((id) => allEntries.find((e) => e.id === id)).filter(Boolean) as JournalEntry[]
    : []

  const linkedChildHypotheses = isHypothesis && allEntries
    ? (entry.linked_child_hypothesis_ids ?? []).map((id) => allEntries.find((e) => e.id === id)).filter(Boolean) as JournalEntry[]
    : []

  const parentHypotheses = isHypothesis && allEntries
    ? allEntries.filter((e) => e.type === 'hypothesis' && e.linked_child_hypothesis_ids?.includes(entry.id))
    : []

  const linkedHypotheses = isFinding && allEntries
    ? allEntries.filter((e) => e.type === 'hypothesis' && e.linked_finding_ids?.includes(entry.id))
    : []

  const cardClass = isTyped
    ? `group border-l-4 ${typeDef.leftBorderClass} ${typeDef.cardBgClass} ${typeDef.cardBorderClass} rounded-lg px-4 py-3 border`
    : 'group bg-gray-800/60 rounded-lg px-4 py-3 border border-gray-700/50'

  return (
    <div id={`entry-${entry.id}`} className={cardClass}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mb-1.5 flex-wrap">
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
                  <span className={`px-1.5 py-0.5 rounded text-xs ${def.tagBgClass} ${def.tagTextClass}`}>
                    {def.label.toUpperCase()}
                  </span>
                  {entry.type === def.type && <span className="ml-auto text-gray-500">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Hypothesis status badge */}
        {isHypothesis && (
          <div className="relative" ref={statusMenuRef}>
            <button
              onClick={() => setShowStatusMenu((v) => !v)}
              className={`no-drag px-1.5 py-0.5 rounded text-xs font-semibold cursor-pointer ${HYPOTHESIS_STATUS_CLASS[status]}`}
              title="Change hypothesis status"
            >
              {HYPOTHESIS_STATUS_LABEL[status]}
            </button>
            {showStatusMenu && (
              <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[110px] shadow-lg">
                {(Object.keys(HYPOTHESIS_STATUS_LABEL) as HypothesisStatus[]).map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => { e.preventDefault(); changeHypothesisStatus(s) }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors hover:bg-gray-700 ${
                      status === s ? 'text-gray-100' : 'text-gray-400'
                    }`}
                  >
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${HYPOTHESIS_STATUS_CLASS[s]}`}>
                      {HYPOTHESIS_STATUS_LABEL[s]}
                    </span>
                    {status === s && <span className="ml-auto text-gray-500">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Action completion checkbox */}
        {isAction && (
          <button
            onClick={toggleCompleted}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
              entry.action_completed
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-orange-500/10 text-orange-400/60 hover:bg-orange-500/20 hover:text-orange-400'
            }`}
            title={entry.action_completed ? 'Mark incomplete' : 'Mark complete'}
          >
            {entry.action_completed ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            )}
            {entry.action_completed ? 'DONE' : 'TODO'}
          </button>
        )}
        {/* Flag toggle */}
        <button
          onClick={toggleFlagged}
          className={`transition-all px-1 ${
            entry.flagged
              ? 'text-amber-400 hover:text-amber-300'
              : 'opacity-0 group-hover:opacity-100 text-gray-600 hover:text-amber-400'
          }`}
          title={entry.flagged ? 'Remove flag' : 'Flag as important'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={entry.flagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
        </button>
      </div>
      {entry.body && (
        <div className={`text-sm font-mono whitespace-pre-wrap break-words leading-relaxed ${
          isAction && entry.action_completed ? 'line-through text-gray-500' : 'text-gray-100'
        }`}>
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
              onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(path) }}
              className={`rounded border border-gray-600 object-contain cursor-pointer transition-all ${
                expandedPath === path ? 'max-h-none w-full' : 'max-h-40'
              }`}
              title={expandedPath === path ? 'Click to collapse' : 'Click to expand'}
            />
          ))}
        </div>
      )}
      {/* Parent hypothesis for child hypotheses */}
      {isHypothesis && parentHypotheses.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-1">Parent Hypothesis</div>
          <div className="flex flex-wrap gap-1.5">
            {parentHypotheses.map((p) => {
              const pStatus = (p.hypothesis_status ?? 'open') as HypothesisStatus
              return (
                <button
                  key={p.id}
                  onClick={() => scrollToEntry(p.id)}
                  className="px-2 py-0.5 rounded text-xs font-mono bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors flex items-center gap-1.5"
                  title={p.body}
                >
                  <span className={`text-xs font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[pStatus]}`}>
                    {HYPOTHESIS_STATUS_LABEL[pStatus]}
                  </span>
                  <span className="truncate max-w-[180px]">{p.body || '(no text)'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {/* Linked findings for hypothesis entries — click to expand full detail */}
      {isHypothesis && linkedFindings.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-1">Findings</div>
          {linkedFindings.map((f) => {
            const isExpanded = expandedFindingIds.has(f.id)
            return (
              <div key={f.id}>
                <button
                  onClick={() => toggleFindingExpanded(f.id)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs font-mono bg-teal-500/10 border border-teal-500/25 text-teal-300 hover:bg-teal-500/20 transition-colors flex items-center justify-between gap-2"
                  title={isExpanded ? 'Collapse finding' : 'Expand finding'}
                >
                  <span className="truncate">{f.body || '(no text)'}</span>
                  <span className="flex-shrink-0 text-gray-600">{isExpanded ? '▲' : '▼'}</span>
                </button>
                {isExpanded && <FindingDetailCard finding={f} />}
              </div>
            )
          })}
        </div>
      )}
      {/* Child hypotheses for hypothesis entries — click to scroll */}
      {isHypothesis && linkedChildHypotheses.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-1">Child Hypotheses</div>
          <div className="flex flex-wrap gap-1.5">
            {linkedChildHypotheses.map((ch) => {
              const chStatus = (ch.hypothesis_status ?? 'open') as HypothesisStatus
              return (
                <button
                  key={ch.id}
                  onClick={() => scrollToEntry(ch.id)}
                  className="px-2 py-0.5 rounded text-xs font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition-colors flex items-center gap-1.5"
                  title={ch.body}
                >
                  <span className={`text-xs font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[chStatus]}`}>
                    {HYPOTHESIS_STATUS_LABEL[chStatus]}
                  </span>
                  <span className="truncate max-w-[180px]">{ch.body || '(no text)'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {/* Linked hypotheses for finding entries — click to scroll to hypothesis */}
      {isFinding && linkedHypotheses.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-1">Hypotheses</div>
          <div className="flex flex-wrap gap-1.5">
            {linkedHypotheses.map((h) => {
              const hStatus = (h.hypothesis_status ?? 'open') as HypothesisStatus
              return (
                <button
                  key={h.id}
                  onClick={() => scrollToEntry(h.id)}
                  className="px-2 py-0.5 rounded text-xs font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition-colors flex items-center gap-1.5"
                  title={h.body}
                >
                  <span className={`text-xs font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[hStatus]}`}>
                    {HYPOTHESIS_STATUS_LABEL[hStatus]}
                  </span>
                  <span className="truncate max-w-[180px]">{h.body || '(no text)'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function DetailsEntryList({ entries, allEntries, onEntryUpdated }: Props): JSX.Element {
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
        <DetailsEntryRow key={entry.id} entry={entry} allEntries={allEntries ?? entries} onEntryUpdated={onEntryUpdated} />
      ))}
    </div>
  )
}
