import { useState } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_TEXT_CLASS } from '@shared/entry-types'
import { scrollToEntry } from '@shared/scroll-to-entry'
import { FlagIcon } from '@shared/FlagIcon'

type PanelTab = 'flagged' | 'finding' | 'hypothesis' | 'action'

interface Props {
  entries: JournalEntry[]
  onClose: () => void
}

const TABS: { type: PanelTab; label: string; icon: string }[] = [
  { type: 'flagged', label: 'Flagged', icon: '⚑' },
  { type: 'finding', label: 'Findings', icon: '◆' },
  { type: 'hypothesis', label: 'Hypotheses', icon: '⬡' },
  { type: 'action', label: 'Actions', icon: '☐' }
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
  }
}

const CARD_COLORS: Record<PanelTab, { bg: string; border: string; hover: string }> = {
  flagged: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', hover: 'hover:bg-amber-500/25' },
  finding: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', hover: 'hover:bg-teal-500/25' },
  hypothesis: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', hover: 'hover:bg-violet-500/25' },
  action: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', hover: 'hover:bg-orange-500/25' }
}


function HypothesisCard({ entry }: { entry: JournalEntry }) {
  const status = entry.hypothesis_status ?? 'open'
  const findingCount = entry.linked_finding_ids?.length ?? 0
  const childCount = entry.linked_child_hypothesis_ids?.length ?? 0
  const colors = CARD_COLORS.hypothesis
  return (
    <button
      onClick={() => scrollToEntry(entry.id)}
      className={`no-drag w-full text-left px-2 py-1.5 rounded ${colors.bg} border ${colors.border} ${colors.hover} transition-colors`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-xs font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[status]}`}>
          {HYPOTHESIS_STATUS_LABEL[status]}
        </span>
        {entry.flagged && <FlagIcon size={10} className="text-amber-400 flex-shrink-0" />}
        {findingCount > 0 && (
          <span className="text-xs text-gray-600">· {findingCount}f</span>
        )}
        {childCount > 0 && (
          <span className="text-xs text-gray-600">· {childCount}h</span>
        )}
      </div>
      <div className="text-xs text-gray-300 line-clamp-2 font-mono leading-tight">
        {entry.body || '(no text)'}
      </div>
    </button>
  )
}

function FindingCard({ entry }: { entry: JournalEntry }) {
  const colors = CARD_COLORS.finding
  return (
    <button
      onClick={() => scrollToEntry(entry.id)}
      className={`no-drag w-full text-left px-2 py-1.5 rounded ${colors.bg} border ${colors.border} ${colors.hover} transition-colors`}
    >
      {entry.flagged && (
        <div className="mb-0.5"><FlagIcon size={10} className="text-amber-400 flex-shrink-0" /></div>
      )}
      <div className="text-xs text-gray-300 line-clamp-2 font-mono leading-tight">
        {entry.body || '(no text)'}
      </div>
    </button>
  )
}

function ActionCard({ entry }: { entry: JournalEntry }) {
  const colors = CARD_COLORS.action
  const completed = entry.action_completed ?? false
  return (
    <button
      onClick={() => scrollToEntry(entry.id)}
      className={`no-drag w-full text-left px-2 py-1.5 rounded ${colors.bg} border ${colors.border} ${colors.hover} transition-colors`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-xs font-semibold ${completed ? 'text-green-300' : 'text-orange-300'}`}>
          {completed ? '✓ Done' : '○ Open'}
        </span>
        {entry.flagged && <FlagIcon size={10} className="text-amber-400 flex-shrink-0" />}
      </div>
      <div className="text-xs text-gray-300 line-clamp-2 font-mono leading-tight">
        {entry.body || '(no text)'}
      </div>
    </button>
  )
}

function FlaggedCard({ entry }: { entry: JournalEntry }) {
  const colors = CARD_COLORS.flagged
  const typeDef = entry.type !== 'note' ? entry.type.charAt(0).toUpperCase() + entry.type.slice(1) : null
  const isHypothesis = entry.type === 'hypothesis'
  const status = entry.hypothesis_status ?? 'open'
  const isAction = entry.type === 'action'
  const completed = entry.action_completed ?? false
  return (
    <button
      onClick={() => scrollToEntry(entry.id)}
      className={`no-drag w-full text-left px-2 py-1.5 rounded ${colors.bg} border ${colors.border} ${colors.hover} transition-colors`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <FlagIcon size={10} className="text-amber-400 flex-shrink-0" />
        {typeDef && (
          <span className="text-xs text-gray-500 font-medium">{typeDef}</span>
        )}
        {isHypothesis && (
          <span className={`text-xs font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[status]}`}>
            {HYPOTHESIS_STATUS_LABEL[status]}
          </span>
        )}
        {isAction && (
          <span className={`text-xs font-semibold ${completed ? 'text-green-300' : 'text-orange-300'}`}>
            {completed ? '✓' : '○'}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-300 line-clamp-2 font-mono leading-tight">
        {entry.body || '(no text)'}
      </div>
    </button>
  )
}

const CARD_COMPONENT: Record<PanelTab, React.ComponentType<{ entry: JournalEntry }>> = {
  flagged: FlaggedCard,
  finding: FindingCard,
  hypothesis: HypothesisCard,
  action: ActionCard
}

const EMPTY_HINT: Record<PanelTab, string> = {
  flagged: 'No flagged entries.\nFlag important entries with the flag icon.',
  finding: 'No findings yet.\nUse /finding to add one.',
  hypothesis: 'No hypotheses yet.\nUse /hypothesis to add one.',
  action: 'No actions yet.\nUse /action to add one.'
}

export function EntityPanel({ entries, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>('hypothesis')
  const colors = TAB_COLORS[activeTab]
  const filtered = activeTab === 'flagged'
    ? entries.filter((e) => e.flagged)
    : entries.filter((e) => e.type === activeTab)
  const Card = CARD_COMPONENT[activeTab]

  return (
    <div className={`w-full border-l-2 ${colors.border} ${colors.bg} flex flex-col flex-shrink-0`}>
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
                onClick={() => setActiveTab(tab.type)}
                className={`no-drag text-xs px-1.5 py-0.5 rounded transition-colors font-medium ${
                  isActive ? tabColors.active : tabColors.inactive
                }`}
                title={tab.label}
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
          title="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-600 px-3 text-center font-mono leading-relaxed whitespace-pre-line">
          {EMPTY_HINT[activeTab]}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5">
          {filtered.map((entry) => (
            <Card key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
