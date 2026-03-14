import React, { useEffect, useRef, useState } from 'react'
import type { JournalEntry, EntryType, HypothesisStatus } from '@shared/ipc-types'
import { getEntryTypeDefinition, ENTRY_TYPES, HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_CLASS } from '@shared/entry-types'
import { LinkFindingModal } from './LinkFindingModal'

interface Props {
  entries: JournalEntry[]
  editingEntryId: string | null
  onEditingEntryIdChange: (id: string | null) => void
  onEntryUpdated: (entry: JournalEntry) => void
  onEntryDeleted: (id: string) => void
}

function getCaretOffsetTop(textarea: HTMLTextAreaElement, position: number): number {
  const div = document.createElement('div')
  const s = window.getComputedStyle(textarea)
  div.style.position = 'absolute'
  div.style.top = '-9999px'
  div.style.left = '-9999px'
  div.style.visibility = 'hidden'
  div.style.overflow = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  div.style.width = s.width
  div.style.paddingLeft = s.paddingLeft
  div.style.paddingRight = s.paddingRight
  div.style.font = s.font
  div.style.letterSpacing = s.letterSpacing
  div.style.lineHeight = s.lineHeight
  div.textContent = textarea.value.substring(0, position)
  const span = document.createElement('span')
  span.textContent = '\u200b'
  div.appendChild(span)
  document.body.appendChild(div)
  const top = span.offsetTop
  document.body.removeChild(div)
  return top
}

function formatTimestamp(isoString: string): string {
  try {
    const normalized = isoString.endsWith('Z') ? isoString : isoString + 'Z'
    const date = new Date(normalized)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  } catch {
    return isoString
  }
}


interface EntryRowProps {
  entry: JournalEntry
  allEntries: JournalEntry[]
  isEditing: boolean
  onEditStart: () => void
  onEditEnd: () => void
  onNavigateUp: (() => void) | undefined
  onNavigateDown: () => void
  onUpdated: (entry: JournalEntry) => void
  onDeleted: (id: string) => void
}

function EntryRow({ entry, allEntries, isEditing, onEditStart, onEditEnd, onNavigateUp, onNavigateDown, onUpdated, onDeleted }: EntryRowProps) {
  const [draft, setDraft] = useState(entry.body)
  const [saving, setSaving] = useState(false)
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({})
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set())
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typeMenuRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    for (const path of entry.image_paths) {
      if (!imageDataUrls[path]) {
        window.electronAPI.getEntryImage(path).then((dataUrl) => {
          setImageDataUrls((prev) => ({ ...prev, [path]: dataUrl }))
        }).catch(() => {})
      }
    }
  }, [entry.image_paths])

  // Initialise draft and focus when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setDraft(entry.body)
      setPendingRemovals(new Set())
      textareaRef.current?.focus()
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }
  }, [isEditing])

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
      onUpdated(updated)
    } catch (err) {
      console.error('[overlay] Failed to change entry type:', err)
    }
  }

  const changeHypothesisStatus = async (status: HypothesisStatus) => {
    setShowStatusMenu(false)
    try {
      const updated = await window.electronAPI.updateHypothesisStatus(entry.id, status)
      onUpdated(updated)
    } catch (err) {
      console.error('[overlay] Failed to change hypothesis status:', err)
    }
  }

  const cancelEdit = () => {
    setDraft(entry.body)
    setPendingRemovals(new Set())
    onEditEnd()
  }

  const saveEdit = async () => {
    const trimmed = draft.trim()
    const hasImages = entry.image_paths.length > pendingRemovals.size
    if (!trimmed && !hasImages) {
      cancelEdit()
      return
    }
    if (trimmed === entry.body && pendingRemovals.size === 0) {
      cancelEdit()
      return
    }
    setSaving(true)
    try {
      const keepImagePaths = pendingRemovals.size > 0
        ? entry.image_paths.filter((p) => !pendingRemovals.has(p))
        : undefined
      const updated = await window.electronAPI.updateEntry(entry.id, trimmed, keepImagePaths)
      onUpdated(updated)
      onEditEnd()
      setPendingRemovals(new Set())
    } catch (err) {
      console.error('[overlay] Failed to update entry:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      cancelEdit()
    } else if (e.key === 'ArrowUp' && onNavigateUp) {
      const isUnmodified = draft.trim() === entry.body.trim() && pendingRemovals.size === 0
      if (isUnmodified) {
        const caretTop = getCaretOffsetTop(e.currentTarget, e.currentTarget.selectionStart)
        const firstTop = getCaretOffsetTop(e.currentTarget, 0)
        if (caretTop <= firstTop) {
          e.preventDefault()
          cancelEdit()
          onNavigateUp()
        }
      }
    } else if (e.key === 'ArrowDown') {
      const isUnmodified = draft.trim() === entry.body.trim() && pendingRemovals.size === 0
      if (isUnmodified) {
        const caretTop = getCaretOffsetTop(e.currentTarget, e.currentTarget.selectionStart)
        const endTop = getCaretOffsetTop(e.currentTarget, e.currentTarget.value.length)
        if (caretTop >= endTop) {
          e.preventDefault()
          cancelEdit()
          onNavigateDown()
        }
      }
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return
    try {
      await window.electronAPI.deleteEntry(entry.id)
      onDeleted(entry.id)
    } catch (err) {
      console.error('[overlay] Failed to delete entry:', err)
    }
  }

  const toggleRemoval = (path: string) => {
    setPendingRemovals((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const visiblePaths = entry.image_paths.filter((p) => !pendingRemovals.has(p))

  const scrollToEntry = (id: string) => {
    document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const typeDef = getEntryTypeDefinition(entry.type ?? 'note')
  const isTyped = entry.type !== 'note'
  const isHypothesis = entry.type === 'hypothesis'
  const isFinding = entry.type === 'finding'
  const status = entry.hypothesis_status ?? 'open'

  const linkedFindings = isHypothesis
    ? (entry.linked_finding_ids ?? []).map((id) => allEntries.find((e) => e.id === id)).filter(Boolean) as JournalEntry[]
    : []

  const linkedHypotheses = isFinding
    ? allEntries.filter((e) => e.type === 'hypothesis' && e.linked_finding_ids?.includes(entry.id))
    : []

  const cardClass = isTyped
    ? `group border-l-4 ${typeDef.leftBorderClass} ${typeDef.cardBgClass} ${typeDef.cardBorderClass} rounded-lg px-3 py-2 border`
    : 'group bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/50'

  return (
    <div id={`entry-${entry.id}`} className={cardClass}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono select-none flex-wrap">
          {formatTimestamp(entry.created_at)}
          {/* Type badge */}
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
              !isEditing && (
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
              )
            )}
            {showTypeMenu && (
              <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[120px] shadow-lg">
                {ENTRY_TYPES.map((def) => (
                  <button
                    key={def.type}
                    onMouseDown={(e) => { e.preventDefault(); changeType(def.type) }}
                    className={`no-drag w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors hover:bg-gray-700 ${
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
                      className={`no-drag w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors hover:bg-gray-700 ${
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
          {/* Link Finding button for hypotheses */}
          {isHypothesis && !isEditing && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="no-drag opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-teal-400 px-1 text-xs"
              title="Link findings"
            >
              + finding
            </button>
          )}
        </div>
        {!isEditing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEditStart}
              className="no-drag text-gray-500 hover:text-gray-300 transition-colors px-1"
              title="Edit"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="no-drag text-gray-500 hover:text-red-400 transition-colors px-1"
              title="Delete"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            rows={3}
            className="no-drag w-full bg-gray-700/80 text-gray-100 font-mono text-sm rounded px-2 py-1.5 border border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
          />
          {entry.image_paths.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {entry.image_paths.map((path) => {
                const markedForRemoval = pendingRemovals.has(path)
                return (
                  <div key={path} className="relative inline-block">
                    <img
                      src={imageDataUrls[path]}
                      alt="Attached"
                      className={`max-h-20 max-w-[100px] rounded border object-contain transition-opacity ${
                        markedForRemoval ? 'opacity-30 border-red-500' : 'border-gray-600'
                      }`}
                    />
                    <button
                      onClick={() => toggleRemoval(path)}
                      className={`no-drag absolute -top-1.5 -right-1.5 rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none transition-colors ${
                        markedForRemoval
                          ? 'bg-gray-600 hover:bg-gray-500 text-gray-400'
                          : 'bg-red-700 hover:bg-red-600 text-white'
                      }`}
                      title={markedForRemoval ? 'Keep image' : 'Remove image'}
                    >
                      {markedForRemoval ? '↩' : '×'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          {pendingRemovals.size > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              {pendingRemovals.size} image{pendingRemovals.size > 1 ? 's' : ''} will be removed on save.
            </div>
          )}
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="no-drag text-xs px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="no-drag text-xs px-2 py-0.5 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {entry.body && (
            <div
              onDoubleClick={onEditStart}
              className="text-gray-100 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed cursor-text"
            >
              {entry.body}
            </div>
          )}
          {visiblePaths.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${entry.body ? 'mt-1.5' : ''}`}>
              {visiblePaths.map((path) => (
                <img
                  key={path}
                  src={imageDataUrls[path]}
                  alt="Attached"
                  onClick={() => setExpandedPath(expandedPath === path ? null : path)}
                  className={`rounded border border-gray-600 object-contain cursor-pointer transition-all ${
                    expandedPath === path ? 'max-h-none w-full' : 'max-h-24'
                  }`}
                  title={expandedPath === path ? 'Click to collapse' : 'Click to expand'}
                />
              ))}
            </div>
          )}
          {/* Linked findings chips for hypothesis entries — click to scroll */}
          {isHypothesis && linkedFindings.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {linkedFindings.map((f) => (
                <button
                  key={f.id}
                  onClick={() => scrollToEntry(f.id)}
                  className="no-drag px-1.5 py-0.5 rounded text-xs font-mono bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/30 transition-colors truncate max-w-[160px]"
                  title={`Go to finding: ${f.body}`}
                >
                  {f.body || '(no text)'}
                </button>
              ))}
            </div>
          )}
          {/* Linked hypothesis chips for finding entries — click to scroll */}
          {isFinding && linkedHypotheses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {linkedHypotheses.map((h) => (
                <button
                  key={h.id}
                  onClick={() => scrollToEntry(h.id)}
                  className="no-drag px-1.5 py-0.5 rounded text-xs font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors truncate max-w-[160px]"
                  title={`Go to hypothesis: ${h.body}`}
                >
                  {h.body || '(no text)'}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Link Finding Modal */}
      {showLinkModal && (
        <LinkFindingModal
          hypothesis={entry}
          findings={allEntries.filter((e) => e.type === 'finding')}
          onClose={() => setShowLinkModal(false)}
          onHypothesisUpdated={(updated) => onUpdated(updated)}
        />
      )}
    </div>
  )
}

export function EntryList({ entries, editingEntryId, onEditingEntryIdChange, onEntryUpdated, onEntryDeleted }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm font-mono">
        No entries yet. Start typing below.
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      {entries.map((entry, i) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          allEntries={entries}
          isEditing={editingEntryId === entry.id}
          onEditStart={() => onEditingEntryIdChange(entry.id)}
          onEditEnd={() => onEditingEntryIdChange(null)}
          onNavigateUp={i > 0 ? () => onEditingEntryIdChange(entries[i - 1].id) : undefined}
          onNavigateDown={() => i < entries.length - 1 ? onEditingEntryIdChange(entries[i + 1].id) : onEditingEntryIdChange(null)}
          onUpdated={onEntryUpdated}
          onDeleted={onEntryDeleted}
        />
      ))}
    </div>
  )
}
