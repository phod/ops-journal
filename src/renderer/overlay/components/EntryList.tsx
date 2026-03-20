import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { JournalEntry, EntryType } from '@shared/ipc-types'
import { MAX_IMAGES_PER_ENTRY } from '@shared/ipc-types'
import type { EntryTypeDefinition } from '@shared/entry-types'
import { getEntryTypeDefinition, HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_CLASS, TOOL_ENTRY_STATUS_LABEL, TOOL_ENTRY_STATUS_CLASS } from '@shared/entry-types'
import { parseSlashCommand, getCompletions } from '@shared/slash-commands'
import { useEntryImages } from '@shared/useEntryImages'
import { useEntryActions } from '@shared/useEntryActions'
import { useEntryRelationships } from '@shared/useEntryRelationships'
import { FlagIcon } from '@shared/FlagIcon'
import { formatRelativeTime } from '@shared/format-date'
import { useClickOutside } from '@shared/useClickOutside'
import { scrollToEntry } from '@shared/scroll-to-entry'
import { AutocompleteDropdown } from '@shared/AutocompleteDropdown'
import { extractPastedImages } from '@shared/image-paste'
import { EntryTypeMenu } from '@shared/EntryTypeMenu'
import { HypothesisStatusMenu } from '@shared/HypothesisStatusMenu'
import { ToolEntryStatusMenu } from '@shared/ToolEntryStatusMenu'
import { LinkFindingModal } from './LinkFindingModal'
import { LinkHypothesisModal } from './LinkHypothesisModal'
import { HighlightedText } from '@shared/HighlightedText'
import { useEntryDrag } from '../contexts/EntryDragContext'
import { getLinkAction } from '@shared/link-drag-utils'

interface Props {
  entries: JournalEntry[]
  editingEntryId: string | null
  onEditingEntryIdChange: (id: string | null) => void
  onEntryUpdated: (entry: JournalEntry) => void
  onEntryDeleted: (id: string) => void
  searchTerm?: string
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
  searchTerm?: string
}

function EntryRow({ entry, allEntries, isEditing, onEditStart, onEditEnd, onNavigateUp, onNavigateDown, onUpdated, onDeleted, searchTerm }: EntryRowProps) {
  const [draft, setDraft] = useState(entry.body)
  const [saving, setSaving] = useState(false)
  const imageDataUrls = useEntryImages(entry.image_paths)
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set())
  const [pendingNewImages, setPendingNewImages] = useState<string[]>([])
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [completions, setCompletions] = useState<EntryTypeDefinition[]>([])
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0)
  const [detectedType, setDetectedType] = useState<EntryType | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typeMenuRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const prevEditHeightRef = useRef(0)

  // Initialise draft and focus when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setDraft(entry.body)
      setPendingRemovals(new Set())
      setPendingNewImages([])
      setCompletions([])
      setDetectedType(null)
      textareaRef.current?.focus()
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }
  }, [isEditing])

  // Auto-resize edit textarea to fit content, then scroll into view only if height changed.
  // useLayoutEffect ensures sizing happens before the browser paints, so the user never
  // sees the textarea at its collapsed/min-height state.
  useLayoutEffect(() => {
    if (!isEditing) {
      prevEditHeightRef.current = 0
      return
    }
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset to auto to measure natural content height, then apply it
    textarea.style.height = 'auto'
    const newHeight = textarea.scrollHeight
    textarea.style.height = `${newHeight}px`

    if (newHeight === prevEditHeightRef.current) return
    prevEditHeightRef.current = newHeight

    const entryEl = document.getElementById(`entry-${entry.id}`)
    const container = entryEl?.parentElement
    if (!entryEl || !container) return
    const entryRect = entryEl.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    if (entryRect.top < containerRect.top || entryRect.bottom > containerRect.bottom) {
      entryEl.scrollIntoView({ block: 'nearest' })
    }
  }, [draft, isEditing])

  useClickOutside(typeMenuRef, showTypeMenu, () => setShowTypeMenu(false))
  useClickOutside(statusMenuRef, showStatusMenu, () => setShowStatusMenu(false))

  const { changeType, changeHypothesisStatus, changeToolEntryStatus, toggleCompleted, toggleFlagged } = useEntryActions({
    entry,
    onUpdated,
    setShowTypeMenu,
    setShowStatusMenu
  })

  const cancelEdit = () => {
    setDraft(entry.body)
    setPendingRemovals(new Set())
    setPendingNewImages([])
    setCompletions([])
    setDetectedType(null)
    onEditEnd()
  }

  const handleDraftChange = (newValue: string) => {
    setDraft(newValue)
    // Extract the leading slash prefix (before any space) for completions
    const trimmed = newValue.trimStart()
    const prefixMatch = trimmed.match(/^(\/\S*)/)
    const prefix = prefixMatch ? prefixMatch[1] : ''
    const newCompletions = getCompletions(prefix)
    setCompletions(newCompletions)
    setSelectedCompletionIndex(0)
    const parsed = parseSlashCommand(newValue.trim())
    setDetectedType(parsed.type !== 'note' ? parsed.type : null)
  }

  const applyCompletion = (def: EntryTypeDefinition) => {
    const cmd = def.command! + ' '
    // Replace the leading slash prefix, keep the rest of the text
    const trimmed = draft.trimStart()
    const prefixMatch = trimmed.match(/^\/\S*\s?/)
    const rest = prefixMatch ? trimmed.slice(prefixMatch[0].length) : trimmed
    setDraft(cmd + rest)
    setDetectedType(def.type)
    setCompletions([])
    textareaRef.current?.focus()
  }

  const totalImageCount = entry.image_paths.length - pendingRemovals.size + pendingNewImages.length
  const editAtLimit = totalImageCount >= MAX_IMAGES_PER_ENTRY

  const addNewImages = useCallback((dataUrls: string[]) => {
    setPendingNewImages((prev) => {
      const remaining = entry.image_paths.length - pendingRemovals.size
      const slots = MAX_IMAGES_PER_ENTRY - remaining - prev.length
      if (slots <= 0) return prev
      return [...prev, ...dataUrls.slice(0, slots)]
    })
  }, [entry.image_paths.length, pendingRemovals.size])

  const handleEditPaste = useCallback((e: React.ClipboardEvent) => {
    extractPastedImages(e, (dataUrl) => addNewImages([dataUrl]))
  }, [addNewImages])

  const saveEdit = async () => {
    const trimmed = draft.trim()
    const hasImages = entry.image_paths.length > pendingRemovals.size || pendingNewImages.length > 0
    if (!trimmed && !hasImages) {
      try {
        await window.electronAPI.deleteEntry(entry.id)
        onDeleted(entry.id)
      } catch (err) {
        console.error('[overlay] Failed to delete empty entry:', err)
      }
      return
    }

    // Check for slash command at the start of the edited text
    const { type: parsedType, body: parsedBody } = parseSlashCommand(trimmed)
    const newBody = parsedType !== 'note' ? parsedBody : trimmed
    const newType = parsedType !== 'note' ? parsedType : undefined

    if (newBody === entry.body && pendingRemovals.size === 0 && !newType && pendingNewImages.length === 0) {
      cancelEdit()
      return
    }
    setSaving(true)
    try {
      const keepImagePaths = pendingRemovals.size > 0
        ? entry.image_paths.filter((p) => !pendingRemovals.has(p))
        : undefined
      const updated = await window.electronAPI.updateEntry(
        entry.id, newBody, keepImagePaths, newType,
        pendingNewImages.length > 0 ? pendingNewImages : undefined
      )
      onUpdated(updated)
      onEditEnd()
      setPendingRemovals(new Set())
      setPendingNewImages([])
    } catch (err) {
      console.error('[overlay] Failed to update entry:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (completions.length > 0) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        applyCompletion(completions[selectedCompletionIndex])
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCompletionIndex((i) => (i + 1) % completions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCompletionIndex((i) => (i - 1 + completions.length) % completions.length)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setCompletions([])
        return
      }
    }

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


  const typeDef = getEntryTypeDefinition(entry.type ?? 'note')
  const isTyped = entry.type !== 'note'
  const isHypothesis = entry.type === 'hypothesis'
  const isFinding = entry.type === 'finding'
  const isAction = entry.type === 'action'
  const isTool = entry.type === 'tool'
  const status = entry.hypothesis_status ?? 'open'
  const toolStatus = entry.tool_status ?? 'pending'

  const { linkedFindings, linkedActions, linkedChildHypotheses, parentHypotheses, linkedHypotheses } = useEntryRelationships(entry, allEntries)

  // Drag-and-drop linking
  const { draggedEntry, validTargetIds, hoveredTargetId, startDrag, endDrag, setHoveredTarget } = useEntryDrag()
  const isDragSource = draggedEntry?.id === entry.id
  const isLinkable = entry.type === 'hypothesis' || entry.type === 'finding' || entry.type === 'action'
  const isDragInProgress = draggedEntry !== null
  const isValidTarget = isDragInProgress && validTargetIds.has(entry.id)
  const isHoveredTarget = hoveredTargetId === entry.id && isValidTarget

  const handleLinkDragStart = (e: React.DragEvent) => {
    if (isEditing || !isLinkable) return
    e.dataTransfer.effectAllowed = 'link'
    e.dataTransfer.setData('application/x-ops-entry-link', entry.id)
    startDrag(entry)
  }

  const handleLinkDragEnd = () => {
    endDrag()
  }

  const handleLinkDragOver = (e: React.DragEvent) => {
    if (!isValidTarget) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'link'
    setHoveredTarget(entry.id)
  }

  const handleLinkDragLeave = () => {
    if (hoveredTargetId === entry.id) setHoveredTarget(null)
  }

  const handleLinkDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setHoveredTarget(null)
    if (!draggedEntry) return
    const action = getLinkAction(draggedEntry, entry)
    if (!action) return
    try {
      let updated: JournalEntry
      switch (action.type) {
        case 'hypothesis-finding':
          updated = await window.electronAPI.linkHypothesisFinding(action.hypothesisId, action.otherId)
          break
        case 'hypothesis-action':
          updated = await window.electronAPI.linkHypothesisAction(action.hypothesisId, action.otherId)
          break
        case 'hypothesis-child':
          updated = await window.electronAPI.linkHypothesisChild(action.hypothesisId, action.otherId)
          break
      }
      onUpdated(updated)
    } catch (err) {
      console.error('[overlay] Failed to link entries via drag:', err)
    }
  }

  const unlinkAction = async (actionId: string) => {
    try {
      const updated = await window.electronAPI.unlinkHypothesisAction(entry.id, actionId)
      onUpdated(updated)
    } catch (err) {
      console.error('[overlay] Failed to unlink action:', err)
    }
  }

  const unlinkFinding = async (findingId: string) => {
    try {
      const updated = await window.electronAPI.unlinkHypothesisFinding(entry.id, findingId)
      onUpdated(updated)
    } catch (err) {
      console.error('[overlay] Failed to unlink finding:', err)
    }
  }

  const unlinkChildHypothesis = async (childId: string) => {
    try {
      const updated = await window.electronAPI.unlinkHypothesisChild(entry.id, childId)
      onUpdated(updated)
    } catch (err) {
      console.error('[overlay] Failed to unlink child hypothesis:', err)
    }
  }

  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const range = selection.getRangeAt(0)
    const fragment = range.cloneContents()
    const imgs = fragment.querySelectorAll('img')
    if (imgs.length === 0) return

    e.preventDefault()

    const plainText = selection.toString()
    const wrapper = document.createElement('div')
    wrapper.appendChild(fragment)
    e.clipboardData.setData('text/plain', plainText)
    e.clipboardData.setData('text/html', wrapper.innerHTML)
  }, [])

  const baseCardClass = isTyped
    ? `group border-l-4 ${typeDef.leftBorderClass} ${typeDef.cardBgClass} ${typeDef.cardBorderClass} rounded-lg px-3 py-2 border`
    : 'group bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/50'

  let dragClass = ''
  if (isDragInProgress) {
    if (isDragSource) {
      dragClass = 'opacity-50'
    } else if (isHoveredTarget) {
      dragClass = 'ring-2 ring-indigo-400 bg-indigo-500/20'
    } else if (isValidTarget) {
      dragClass = 'ring-2 ring-indigo-400/50'
    } else {
      dragClass = 'opacity-40'
    }
  }

  const cardClass = `${baseCardClass} ${dragClass} transition-all`

  return (
    <div
      id={`entry-${entry.id}`}
      className={cardClass}
      onCopy={handleCopy}
      draggable={!isEditing && isLinkable}
      onDragStart={handleLinkDragStart}
      onDragEnd={handleLinkDragEnd}
      onDragOver={handleLinkDragOver}
      onDragLeave={handleLinkDragLeave}
      onDrop={handleLinkDrop}
      style={!isEditing && isLinkable ? { cursor: 'grab' } : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono select-none flex-wrap">
          {formatRelativeTime(entry.created_at)}
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
              <EntryTypeMenu currentType={entry.type} onSelect={changeType} />
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
                <HypothesisStatusMenu currentStatus={status} onSelect={changeHypothesisStatus} />
              )}
            </div>
          )}
          {/* Action completion checkbox */}
          {isAction && (
            <button
              onClick={toggleCompleted}
              className={`no-drag flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
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
          {/* Tool entry status badge */}
          {isTool && (
            <div className="relative" ref={statusMenuRef}>
              <button
                onClick={() => setShowStatusMenu((v) => !v)}
                className={`no-drag px-1.5 py-0.5 rounded text-xs font-semibold cursor-pointer ${TOOL_ENTRY_STATUS_CLASS[toolStatus]}`}
                title="Change tool status"
              >
                {TOOL_ENTRY_STATUS_LABEL[toolStatus]}
              </button>
              {showStatusMenu && (
                <ToolEntryStatusMenu currentStatus={toolStatus} onSelect={changeToolEntryStatus} anchorRef={statusMenuRef} />
              )}
            </div>
          )}
          {/* Link button for hypotheses */}
          {isHypothesis && !isEditing && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="no-drag opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-teal-400 px-1 text-xs"
              title="Manage linked findings, actions, and child hypotheses"
            >
              {(linkedFindings.length + linkedActions.length + linkedChildHypotheses.length) > 0 ? 'edit links' : '+ link'}
            </button>
          )}
          {/* Link button for findings */}
          {isFinding && !isEditing && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="no-drag opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-violet-400 px-1 text-xs"
              title="Link to hypotheses"
            >
              {linkedHypotheses.length > 0 ? 'edit links' : '+ link'}
            </button>
          )}
          {/* Link button for actions */}
          {isAction && !isEditing && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="no-drag opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-violet-400 px-1 text-xs"
              title="Link to hypotheses"
            >
              {linkedHypotheses.length > 0 ? 'edit links' : '+ link'}
            </button>
          )}
          {/* Flag toggle */}
          {!isEditing && (
            <button
              onClick={toggleFlagged}
              className={`no-drag transition-all px-1 ${
                entry.flagged
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'opacity-0 group-hover:opacity-100 text-gray-600 hover:text-amber-400'
              }`}
              title={entry.flagged ? 'Remove flag' : 'Flag as important'}
            >
              <FlagIcon filled={!!entry.flagged} className={entry.flagged ? 'text-amber-400' : 'text-current'} />
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
          <div className="relative">
            <AutocompleteDropdown completions={completions} selectedIndex={selectedCompletionIndex} onSelect={applyCompletion} />
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handleEditPaste}
              disabled={saving}
              style={{ minHeight: '5rem' }}
              className="no-drag w-full bg-gray-700/80 text-gray-100 font-mono text-sm rounded px-2 py-1.5 border border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
            />
            {detectedType && (
              <div className="absolute bottom-2 right-2 pointer-events-none">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getEntryTypeDefinition(detectedType).tagBgClass} ${getEntryTypeDefinition(detectedType).tagTextClass}`}>
                  {getEntryTypeDefinition(detectedType).label.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {entry.image_paths.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {entry.image_paths.map((path) => {
                const markedForRemoval = pendingRemovals.has(path)
                return (
                  <div key={path} className="relative inline-block">
                    <img
                      src={imageDataUrls[path]}
                      alt=""
                      className={`max-h-20 max-w-[100px] rounded border object-contain transition-opacity ${
                        markedForRemoval ? 'opacity-30 border-red-500' : 'border-gray-600'
                      }`}
                      onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(path) }}
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
          {pendingNewImages.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {pendingNewImages.map((src, i) => (
                <div key={i} className="relative inline-block">
                  <img
                    src={src}
                    alt={`New attachment ${i + 1}`}
                    className="max-h-20 max-w-[100px] rounded border border-green-600 object-contain"
                  />
                  <button
                    onClick={() => setPendingNewImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="no-drag absolute -top-1.5 -right-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none"
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {pendingRemovals.size > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              {pendingRemovals.size} image{pendingRemovals.size > 1 ? 's' : ''} will be removed on save.
            </div>
          )}
          {editAtLimit && (
            <div className="text-xs text-amber-500 font-mono mt-1">
              Image limit reached ({MAX_IMAGES_PER_ENTRY}/{MAX_IMAGES_PER_ENTRY})
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
              className={`text-sm font-mono whitespace-pre-wrap break-words leading-relaxed cursor-text ${
                isAction && entry.action_completed
                  ? 'line-through text-gray-500'
                  : 'text-gray-100'
              }`}
            >
              {searchTerm ? <HighlightedText text={entry.body} searchTerm={searchTerm} /> : entry.body}
            </div>
          )}
          {visiblePaths.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${entry.body ? 'mt-1.5' : ''}`}>
              {visiblePaths.map((path) => (
                <img
                  key={path}
                  src={imageDataUrls[path]}
                  alt=""
                  onClick={() => setExpandedPath(expandedPath === path ? null : path)}
                  onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(path) }}
                  className={`rounded border border-gray-600 object-contain cursor-pointer transition-all ${
                    expandedPath === path ? 'max-h-none w-full' : 'max-h-24'
                  }`}
                  title={expandedPath === path ? 'Click to collapse' : 'Click to expand'}
                />
              ))}
            </div>
          )}
          {/* Linked findings chips for hypothesis entries — click to scroll, × to unlink */}
          {isHypothesis && linkedFindings.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {linkedFindings.map((f) => (
                <div
                  key={f.id}
                  className="group/chip no-drag flex items-center rounded text-xs font-mono bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 transition-colors max-w-[180px]"
                >
                  <button
                    onClick={() => scrollToEntry(f.id)}
                    className="no-drag px-1.5 py-0.5 truncate"
                    title={`Go to finding: ${f.body}`}
                  >
                    {f.body || '(no text)'}
                  </button>
                  <button
                    onClick={() => unlinkFinding(f.id)}
                    className="no-drag px-1 py-0.5 pb-1 opacity-0 group-hover/chip:opacity-100 text-teal-500 hover:text-red-400 transition-all shrink-0"
                    title="Unlink finding"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Linked action chips for hypothesis entries — click to scroll, × to unlink */}
          {isHypothesis && linkedActions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {linkedActions.map((a) => (
                <div
                  key={a.id}
                  className="group/chip no-drag flex items-center rounded text-xs font-mono bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/20 transition-colors max-w-[180px]"
                >
                  <button
                    onClick={() => scrollToEntry(a.id)}
                    className="no-drag px-1.5 py-0.5 truncate"
                    title={`Go to action: ${a.body}`}
                  >
                    {a.body || '(no text)'}
                  </button>
                  <button
                    onClick={() => unlinkAction(a.id)}
                    className="no-drag px-1 py-0.5 pb-1 opacity-0 group-hover/chip:opacity-100 text-orange-500 hover:text-red-400 transition-all shrink-0"
                    title="Unlink action"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Linked child hypothesis chips — click to scroll, × to unlink */}
          {isHypothesis && linkedChildHypotheses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {linkedChildHypotheses.map((ch) => (
                <div
                  key={ch.id}
                  className="group/chip no-drag flex items-center rounded text-xs font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-colors max-w-[180px]"
                >
                  <button
                    onClick={() => scrollToEntry(ch.id)}
                    className="no-drag px-1.5 py-0.5 truncate"
                    title={`Go to child hypothesis: ${ch.body}`}
                  >
                    {ch.body || '(no text)'}
                  </button>
                  <button
                    onClick={() => unlinkChildHypothesis(ch.id)}
                    className="no-drag px-1 py-0.5 pb-1 opacity-0 group-hover/chip:opacity-100 text-violet-500 hover:text-red-400 transition-all shrink-0"
                    title="Unlink child hypothesis"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Parent hypothesis chips — click to scroll */}
          {isHypothesis && parentHypotheses.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 items-center">
              <span className="text-xs text-gray-600 font-mono">parent:</span>
              {parentHypotheses.map((p) => (
                <button
                  key={p.id}
                  onClick={() => scrollToEntry(p.id)}
                  className="no-drag px-1.5 py-0.5 rounded text-xs font-mono bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors truncate max-w-[160px]"
                  title={`Go to parent hypothesis: ${p.body}`}
                >
                  {p.body || '(no text)'}
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
          {/* Linked hypothesis chips for action entries — click to scroll */}
          {isAction && linkedHypotheses.length > 0 && (
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

      {/* Link Modal for hypotheses */}
      {showLinkModal && isHypothesis && (
        <LinkFindingModal
          hypothesis={entry}
          findings={allEntries.filter((e) => e.type === 'finding')}
          actions={allEntries.filter((e) => e.type === 'action')}
          hypotheses={allEntries.filter((e) => e.type === 'hypothesis')}
          onClose={() => setShowLinkModal(false)}
          onHypothesisUpdated={(updated) => onUpdated(updated)}
        />
      )}
      {/* Link Modal for findings */}
      {showLinkModal && isFinding && (
        <LinkHypothesisModal
          entry={entry}
          hypotheses={allEntries.filter((e) => e.type === 'hypothesis')}
          linkedHypothesisIds={new Set(linkedHypotheses.map((h) => h.id))}
          onClose={() => setShowLinkModal(false)}
        />
      )}
      {/* Link Modal for actions */}
      {showLinkModal && isAction && (
        <LinkHypothesisModal
          entry={entry}
          hypotheses={allEntries.filter((e) => e.type === 'hypothesis')}
          linkedHypothesisIds={new Set(linkedHypotheses.map((h) => h.id))}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  )
}

export function EntryList({ entries, editingEntryId, onEditingEntryIdChange, onEntryUpdated, onEntryDeleted, searchTerm }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const prevEntriesLengthRef = useRef(entries.length)
  useEffect(() => {
    if (scrollRef.current && entries.length > prevEntriesLengthRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevEntriesLengthRef.current = entries.length
  }, [entries])

  // Keep scroll pinned to bottom when the container shrinks (e.g. input box expanding),
  // but only if the user was already at the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let wasAtBottom = true
    const onScroll = () => {
      wasAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10
    }
    const observer = new ResizeObserver(() => {
      if (wasAtBottom) el.scrollTop = el.scrollHeight
    })
    el.addEventListener('scroll', onScroll)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

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
          searchTerm={searchTerm}
        />
      ))}
    </div>
  )
}
