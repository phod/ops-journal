import React, { useState, useMemo } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_TEXT_CLASS, TOOL_ENTRY_STATUS_LABEL, TOOL_ENTRY_STATUS_TEXT_CLASS } from '@shared/entry-types'
import { scrollToEntry } from '@shared/scroll-to-entry'
import { FlagIcon } from '@shared/FlagIcon'
import { LinkedText } from '@shared/LinkedText'
import { useEntryDrag } from '../contexts/EntryDragContext'
import { getLinkAction } from '@shared/link-drag-utils'
import { PeekSection } from './PeekSection'

type PanelTab = 'flagged' | 'finding' | 'hypothesis' | 'action' | 'tool'

const STATUS_CHIPS: Partial<Record<PanelTab, { value: string; label: string; activeClass: string }[]>> = {
  hypothesis: [
    { value: 'open', label: 'Open', activeClass: 'text-yellow-300 bg-yellow-500/20' },
    { value: 'true', label: 'True', activeClass: 'text-green-300 bg-green-500/20' },
    { value: 'false', label: 'False', activeClass: 'text-red-300 bg-red-500/20' },
    { value: 'abandoned', label: 'Aband.', activeClass: 'text-gray-400 bg-gray-500/20' },
  ],
  action: [
    { value: 'incomplete', label: 'TODO', activeClass: 'text-orange-300 bg-orange-500/20' },
    { value: 'completed', label: 'DONE', activeClass: 'text-green-300 bg-green-500/20' },
  ],
  tool: [
    { value: 'pending', label: 'Pending', activeClass: 'text-sky-300 bg-sky-500/20' },
    { value: 'done', label: 'Done', activeClass: 'text-green-300 bg-green-500/20' },
    { value: 'abandoned', label: 'Aband.', activeClass: 'text-gray-400 bg-gray-500/20' },
  ],
}

interface Props {
  entries: JournalEntry[]
  onClose: () => void
  onEntryUpdated: (entry: JournalEntry) => void
}

const TABS: { type: PanelTab; label: string; icon: string }[] = [
  { type: 'flagged', label: 'Flagged', icon: '⚑' },
  { type: 'finding', label: 'Findings', icon: '◆' },
  { type: 'hypothesis', label: 'Hypotheses', icon: '⬡' },
  { type: 'action', label: 'Actions', icon: '☐' },
  { type: 'tool', label: 'Tools', icon: '⚙' }
]

const TAB_COLORS: Record<PanelTab, { active: string; inactive: string; border: string; bg: string; headerText: string }> = {
  flagged: {
    active: 'text-amber-300 bg-amber-500/25',
    inactive: 'text-gray-500 hover:text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/30',
    headerText: 'text-amber-300'
  },
  finding: {
    active: 'text-teal-300 bg-teal-500/25',
    inactive: 'text-gray-500 hover:text-teal-400',
    border: 'border-teal-500/40',
    bg: 'bg-teal-950/30',
    headerText: 'text-teal-300'
  },
  hypothesis: {
    active: 'text-violet-300 bg-violet-500/25',
    inactive: 'text-gray-500 hover:text-violet-400',
    border: 'border-violet-500/40',
    bg: 'bg-violet-950/30',
    headerText: 'text-violet-300'
  },
  action: {
    active: 'text-orange-300 bg-orange-500/25',
    inactive: 'text-gray-500 hover:text-orange-400',
    border: 'border-orange-500/40',
    bg: 'bg-orange-950/30',
    headerText: 'text-orange-300'
  },
  tool: {
    active: 'text-sky-300 bg-sky-500/25',
    inactive: 'text-gray-500 hover:text-sky-400',
    border: 'border-sky-500/40',
    bg: 'bg-sky-950/30',
    headerText: 'text-sky-300'
  }
}

const LEFT_BORDER_COLORS: Record<PanelTab, string> = {
  flagged: 'border-l-amber-500',
  finding: 'border-l-teal-400',
  hypothesis: 'border-l-violet-500',
  action: 'border-l-orange-400',
  tool: 'border-l-sky-400'
}

interface CardDragProps {
  entry: JournalEntry
  onEntryUpdated: (entry: JournalEntry) => void
}

function useCardDrag({ entry, onEntryUpdated }: CardDragProps) {
  const { draggedEntry, validTargetIds, hoveredTargetId, startDrag, endDrag, setHoveredTarget } = useEntryDrag()
  const isLinkable = entry.type === 'hypothesis' || entry.type === 'finding' || entry.type === 'action'
  const isDragInProgress = draggedEntry !== null
  const isDragSource = draggedEntry?.id === entry.id
  const isValidTarget = isDragInProgress && validTargetIds.has(entry.id)
  const isHoveredTarget = hoveredTargetId === entry.id && isValidTarget

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

  const handleDragOver = (e: React.DragEvent) => {
    if (!isValidTarget) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'link'
    setHoveredTarget(entry.id)
  }
  const handleDragLeave = () => { if (hoveredTargetId === entry.id) setHoveredTarget(null) }
  const handleDrop = async (e: React.DragEvent) => {
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
      onEntryUpdated(updated)
    } catch (err) {
      console.error('[overlay] Failed to link entries via drag:', err)
    }
  }

  const dragProps: Record<string, unknown> = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop
  }
  if (isLinkable) {
    dragProps.draggable = true
    dragProps.style = { cursor: 'grab' }
    dragProps.onDragStart = (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'link'
      e.dataTransfer.setData('application/x-ops-entry-link', entry.id)
      startDrag(entry)
    }
    dragProps.onDragEnd = () => endDrag()
  }

  return { dragClass, dragProps }
}

// Compact single-line row card
function CompactRow({ entry, onEntryUpdated, onClick, isPeeked, tab }: {
  entry: JournalEntry
  onEntryUpdated: (e: JournalEntry) => void
  onClick: () => void
  isPeeked: boolean
  tab: PanelTab
}) {
  const { dragClass, dragProps } = useCardDrag({ entry, onEntryUpdated })
  const status = entry.hypothesis_status ?? 'open'
  const toolStatus = entry.tool_status ?? 'pending'
  const completed = entry.action_completed ?? false
  const imageCount = entry.image_paths.length
  const linkCount = (entry.linked_finding_ids?.length ?? 0) +
    (entry.linked_action_ids?.length ?? 0) +
    (entry.linked_child_hypothesis_ids?.length ?? 0)
  const isAbandoned = (entry.type === 'hypothesis' && status === 'abandoned') ||
    (entry.type === 'tool' && toolStatus === 'abandoned')

  return (
    <button
      onClick={onClick}
      className={`no-drag w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left border-l-[3px] ${LEFT_BORDER_COLORS[tab === 'flagged' ? (entry.type as PanelTab) || 'flagged' : tab]} hover:bg-gray-700/25 transition-all ${dragClass} ${isPeeked ? 'bg-gray-700/20' : ''} ${isAbandoned ? 'opacity-45' : ''}`}
      {...dragProps}
    >
      {/* Status indicator for hypothesis/action/tool */}
      {entry.type === 'hypothesis' && (
        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${HYPOTHESIS_STATUS_TEXT_CLASS[status]}`}>
          {HYPOTHESIS_STATUS_LABEL[status]}
        </span>
      )}
      {entry.type === 'action' && (
        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${completed ? 'text-green-300' : 'text-orange-300'}`}>
          {completed ? '✓' : '○'}
        </span>
      )}
      {entry.type === 'tool' && (
        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${TOOL_ENTRY_STATUS_TEXT_CLASS[toolStatus]}`}>
          {TOOL_ENTRY_STATUS_LABEL[toolStatus]}
        </span>
      )}

      {/* Truncated body */}
      <span className="text-[11px] text-gray-300 font-mono truncate flex-1 min-w-0">
        <LinkedText text={entry.body || '(no text)'} />
      </span>

      {/* Right-aligned micro indicators */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {imageCount > 0 && (
          <span className="flex items-center gap-0.5 text-[9px] text-gray-600">
            <span className="inline-block w-3 h-2.5 border border-gray-600 rounded-sm" />
            {imageCount}
          </span>
        )}
        {linkCount > 0 && (
          <span className="text-[9px] px-1.5 py-0 rounded-full bg-violet-500/10 text-violet-400">
            ⬡{linkCount}
          </span>
        )}
        {entry.flagged && <FlagIcon size={9} className="text-amber-400 flex-shrink-0" />}
      </div>
    </button>
  )
}

function DraggablePeekSection({ entry, allEntries, onScrollToEntry, onEntryUpdated }: {
  entry: JournalEntry
  allEntries: JournalEntry[]
  onScrollToEntry: (id: string) => void
  onEntryUpdated: (e: JournalEntry) => void
}) {
  const { dragClass, dragProps } = useCardDrag({ entry, onEntryUpdated })
  return (
    <PeekSection
      entry={entry}
      allEntries={allEntries}
      onScrollToEntry={onScrollToEntry}
      dragProps={dragProps}
      dragClass={dragClass}
    />
  )
}

// Build hypothesis tree for indentation
interface TreeEntry {
  entry: JournalEntry
  depth: number
}

function buildHypothesisTree(hypotheses: JournalEntry[]): TreeEntry[] {
  const byId = new Map(hypotheses.map((h) => [h.id, h]))
  const childIds = new Set<string>()
  for (const h of hypotheses) {
    for (const cid of h.linked_child_hypothesis_ids ?? []) {
      childIds.add(cid)
    }
  }
  // Roots: hypotheses that are not children of any other hypothesis in this list
  const roots = hypotheses.filter((h) => !childIds.has(h.id))
  const result: TreeEntry[] = []
  const visited = new Set<string>()

  function dfs(entry: JournalEntry, depth: number) {
    if (visited.has(entry.id)) return
    visited.add(entry.id)
    result.push({ entry, depth })
    for (const cid of entry.linked_child_hypothesis_ids ?? []) {
      const child = byId.get(cid)
      if (child) dfs(child, depth + 1)
    }
  }

  for (const root of roots) dfs(root, 0)
  // Add any remaining (in cycles or disconnected)
  for (const h of hypotheses) {
    if (!visited.has(h.id)) {
      result.push({ entry: h, depth: 0 })
    }
  }
  return result
}

const EMPTY_HINT: Record<PanelTab, string> = {
  flagged: 'No flagged entries.\nFlag important entries with the flag icon.',
  finding: 'No findings yet.\nUse /finding to add one.',
  hypothesis: 'No hypotheses yet.\nUse /hypothesis to add one.',
  action: 'No actions yet.\nUse /action to add one.',
  tool: 'No tools yet.\nUse /tool to add one.'
}

export function EntityPanel({ entries, onClose, onEntryUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>('hypothesis')
  const [peekedEntryId, setPeekedEntryId] = useState<string | null>(null)
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set())
  const colors = TAB_COLORS[activeTab]

  const filtered = activeTab === 'flagged'
    ? entries.filter((e) => e.flagged)
    : entries.filter((e) => e.type === activeTab)

  const statusFiltered = useMemo(() => {
    if (statusFilters.size === 0) return filtered
    return filtered.filter((e) => {
      if (e.type === 'hypothesis') return statusFilters.has(e.hypothesis_status ?? 'open')
      if (e.type === 'action') return statusFilters.has(e.action_completed ? 'completed' : 'incomplete')
      if (e.type === 'tool') return statusFilters.has(e.tool_status ?? 'pending')
      return true
    })
  }, [filtered, statusFilters])

  // Build tree for hypothesis tab
  const treeEntries = useMemo(() => {
    if (activeTab !== 'hypothesis') return null
    return buildHypothesisTree(statusFiltered)
  }, [activeTab, statusFiltered])

  const handleTabChange = (tab: PanelTab) => {
    setActiveTab(tab)
    setPeekedEntryId(null)
    setStatusFilters(new Set())
  }

  const toggleStatusFilter = (value: string) => {
    setStatusFilters((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const handleCardClick = (entryId: string) => {
    setPeekedEntryId((prev) => prev === entryId ? null : entryId)
  }

  const handleScrollToEntry = (id: string) => {
    scrollToEntry(id)
  }

  const renderCards = () => {
    if (activeTab === 'hypothesis' && treeEntries) {
      return treeEntries.map(({ entry, depth }, i) => {
        const prevDepth = i > 0 ? treeEntries[i - 1].depth : 0
        const showConnector = depth > 0 && (i === 0 || depth > prevDepth || depth === treeEntries[i - 1].depth)
        return (
          <React.Fragment key={entry.id}>
            {showConnector && depth > 0 && (
              <div
                className="bg-violet-500/20"
                style={{ marginLeft: depth * 16 + 1, width: 1, height: 6 }}
              />
            )}
            <div style={{ marginLeft: depth * 16 }}>
              <CompactRow
                entry={entry}
                onEntryUpdated={onEntryUpdated}
                onClick={() => handleCardClick(entry.id)}
                isPeeked={peekedEntryId === entry.id}
                tab={activeTab}
              />
            </div>
            {peekedEntryId === entry.id && (
              <div style={{ marginLeft: depth * 16 }}>
                <DraggablePeekSection
                  entry={entry}
                  allEntries={entries}
                  onScrollToEntry={handleScrollToEntry}
                  onEntryUpdated={onEntryUpdated}
                />
              </div>
            )}
          </React.Fragment>
        )
      })
    }

    return statusFiltered.map((entry) => (
      <React.Fragment key={entry.id}>
        <CompactRow
          entry={entry}
          onEntryUpdated={onEntryUpdated}
          onClick={() => handleCardClick(entry.id)}
          isPeeked={peekedEntryId === entry.id}
          tab={activeTab}
        />
        {peekedEntryId === entry.id && (
          <DraggablePeekSection
            entry={entry}
            allEntries={entries}
            onScrollToEntry={handleScrollToEntry}
            onEntryUpdated={onEntryUpdated}
          />
        )}
      </React.Fragment>
    ))
  }

  return (
    <div className={`w-full h-full border-l-2 ${colors.border} ${colors.bg} flex flex-col flex-shrink-0`}>
      {/* Tab row */}
      <div className="flex items-center justify-between px-1.5 py-1.5 border-b border-gray-700/40">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.type
            const tabColors = TAB_COLORS[tab.type]
            const count = tab.type === 'flagged'
              ? entries.filter((e) => e.flagged).length
              : entries.filter((e) => e.type === tab.type).length
            return (
              <button
                key={tab.type}
                onClick={() => handleTabChange(tab.type)}
                className={`no-drag text-xs px-1.5 py-0.5 rounded transition-colors font-medium ${
                  isActive ? tabColors.active : tabColors.inactive
                }`}
                data-tooltip={tab.label}
              >
                {tab.icon}
                {count > 0 && (
                  <span className="ml-0.5 text-[10px] opacity-70">{count}</span>
                )}
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="no-drag text-gray-600 hover:text-gray-400 text-xs transition-colors px-1"
          data-tooltip="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Status filter chips */}
      {STATUS_CHIPS[activeTab] && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-700/40">
          {STATUS_CHIPS[activeTab]!.map((chip) => {
            const isActive = statusFilters.has(chip.value)
            return (
              <button
                key={chip.value}
                onClick={() => toggleStatusFilter(chip.value)}
                className={`no-drag text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                  isActive ? chip.activeClass : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {statusFiltered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-600 px-3 text-center font-mono leading-relaxed whitespace-pre-line">
          {EMPTY_HINT[activeTab]}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
          {renderCards()}
        </div>
      )}
    </div>
  )
}
