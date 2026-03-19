import { useState } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_TEXT_CLASS } from '@shared/entry-types'
import type { HypothesisStatus } from '@shared/ipc-types'
import { Modal } from '@shared/Modal'

type Tab = 'findings' | 'actions' | 'hypotheses'

interface Props {
  hypothesis: JournalEntry
  findings: JournalEntry[]
  actions: JournalEntry[]
  hypotheses: JournalEntry[]
  onClose: () => void
  onHypothesisUpdated: (entry: JournalEntry) => void
}

export function LinkFindingModal({ hypothesis, findings, actions, hypotheses, onClose, onHypothesisUpdated }: Props) {
  const [current, setCurrent] = useState(hypothesis)
  const [tab, setTab] = useState<Tab>('findings')
  const [error, setError] = useState<string | null>(null)
  const linkedFindingIds = new Set(current.linked_finding_ids ?? [])
  const linkedActionIds = new Set(current.linked_action_ids ?? [])
  const linkedChildIds = new Set(current.linked_child_hypothesis_ids ?? [])

  // Filter out self and any hypothesis that is a parent of this one (to avoid cycles shown in UI)
  const linkableHypotheses = hypotheses.filter((h) => h.id !== hypothesis.id)

  const toggleFinding = async (findingId: string) => {
    setError(null)
    try {
      const updated = linkedFindingIds.has(findingId)
        ? await window.electronAPI.unlinkHypothesisFinding(current.id, findingId)
        : await window.electronAPI.linkHypothesisFinding(current.id, findingId)
      setCurrent(updated)
    } catch (err) {
      console.error('[overlay] Failed to toggle finding link:', err)
    }
  }

  const toggleAction = async (actionId: string) => {
    setError(null)
    try {
      const updated = linkedActionIds.has(actionId)
        ? await window.electronAPI.unlinkHypothesisAction(current.id, actionId)
        : await window.electronAPI.linkHypothesisAction(current.id, actionId)
      setCurrent(updated)
    } catch (err) {
      console.error('[overlay] Failed to toggle action link:', err)
    }
  }

  const toggleChild = async (childId: string) => {
    setError(null)
    try {
      if (linkedChildIds.has(childId)) {
        const updated = await window.electronAPI.unlinkHypothesisChild(current.id, childId)
        setCurrent(updated)
      } else {
        const updated = await window.electronAPI.linkHypothesisChild(current.id, childId)
        setCurrent(updated)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to link hypothesis'
      setError(message)
      console.error('[overlay] Failed to toggle child hypothesis link:', err)
    }
  }

  const handleClose = () => {
    onHypothesisUpdated(current)
    onClose()
  }

  const hasBothTypes = findings.length > 0 || actions.length > 0 || linkableHypotheses.length > 0

  return (
    <Modal onClose={handleClose} className="p-4 w-80 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-100">Link to Hypothesis</h3>
          <button
            onClick={handleClose}
            className="no-drag text-gray-500 hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="text-xs text-gray-500 font-mono mb-3 truncate">
          {hypothesis.body || '(no text)'}
        </div>
        {/* Tabs */}
        {hasBothTypes && (
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => { setTab('findings'); setError(null) }}
              className={`flex-1 text-xs font-mono py-1 rounded transition-colors ${
                tab === 'findings'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-gray-700/50 text-gray-500 border border-gray-700/50 hover:text-gray-300'
              }`}
            >
              Findings{findings.length > 0 ? ` (${findings.length})` : ''}
            </button>
            <button
              onClick={() => { setTab('actions'); setError(null) }}
              className={`flex-1 text-xs font-mono py-1 rounded transition-colors ${
                tab === 'actions'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : 'bg-gray-700/50 text-gray-500 border border-gray-700/50 hover:text-gray-300'
              }`}
            >
              Actions{actions.length > 0 ? ` (${actions.length})` : ''}
            </button>
            <button
              onClick={() => { setTab('hypotheses'); setError(null) }}
              className={`flex-1 text-xs font-mono py-1 rounded transition-colors ${
                tab === 'hypotheses'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                  : 'bg-gray-700/50 text-gray-500 border border-gray-700/50 hover:text-gray-300'
              }`}
            >
              Hypotheses{linkableHypotheses.length > 0 ? ` (${linkableHypotheses.length})` : ''}
            </button>
          </div>
        )}
        {/* Error message */}
        {error && (
          <div className="mb-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            {error}
          </div>
        )}
        {/* Findings tab */}
        {tab === 'findings' && (
          findings.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-6 font-mono">
              No findings in this investigation yet.
            </div>
          ) : (
            <div className="overflow-y-auto space-y-1.5">
              {findings.map((finding) => {
                const isLinked = linkedFindingIds.has(finding.id)
                return (
                  <button
                    key={finding.id}
                    onClick={() => toggleFinding(finding.id)}
                    className={`no-drag w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors flex items-start gap-2 ${
                      isLinked
                        ? 'bg-teal-500/20 border border-teal-500/40 text-teal-200 hover:bg-teal-500/30'
                        : 'bg-gray-700/50 border border-gray-700/50 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-xs leading-none ${
                        isLinked ? 'bg-teal-500 border-teal-400 text-white' : 'border-gray-600'
                      }`}
                    >
                      {isLinked ? '✓' : ''}
                    </span>
                    <span className="line-clamp-2">{finding.body || '(no text)'}</span>
                  </button>
                )
              })}
            </div>
          )
        )}
        {/* Actions tab */}
        {tab === 'actions' && (
          actions.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-6 font-mono">
              No actions in this investigation yet.
            </div>
          ) : (
            <div className="overflow-y-auto space-y-1.5">
              {actions.map((action) => {
                const isLinked = linkedActionIds.has(action.id)
                return (
                  <button
                    key={action.id}
                    onClick={() => toggleAction(action.id)}
                    className={`no-drag w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors flex items-start gap-2 ${
                      isLinked
                        ? 'bg-orange-500/20 border border-orange-500/40 text-orange-200 hover:bg-orange-500/30'
                        : 'bg-gray-700/50 border border-gray-700/50 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-xs leading-none ${
                        isLinked ? 'bg-orange-500 border-orange-400 text-white' : 'border-gray-600'
                      }`}
                    >
                      {isLinked ? '✓' : ''}
                    </span>
                    <span className="line-clamp-2">{action.body || '(no text)'}</span>
                  </button>
                )
              })}
            </div>
          )
        )}
        {/* Hypotheses tab */}
        {tab === 'hypotheses' && (
          linkableHypotheses.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-6 font-mono">
              No other hypotheses in this investigation yet.
            </div>
          ) : (
            <div className="overflow-y-auto space-y-1.5">
              {linkableHypotheses.map((h) => {
                const isLinked = linkedChildIds.has(h.id)
                const status = h.hypothesis_status ?? 'open'
                return (
                  <button
                    key={h.id}
                    onClick={() => toggleChild(h.id)}
                    className={`no-drag w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors flex items-start gap-2 ${
                      isLinked
                        ? 'bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30'
                        : 'bg-gray-700/50 border border-gray-700/50 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-xs leading-none ${
                        isLinked ? 'bg-violet-500 border-violet-400 text-white' : 'border-gray-600'
                      }`}
                    >
                      {isLinked ? '✓' : ''}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`text-xs font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[status]} mr-1`}>
                        {HYPOTHESIS_STATUS_LABEL[status]}
                      </span>
                      <span className="line-clamp-2">{h.body || '(no text)'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )
        )}
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleClose}
            className="no-drag text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Done
          </button>
        </div>
    </Modal>
  )
}
