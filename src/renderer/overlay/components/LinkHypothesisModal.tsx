import { useState } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_TEXT_CLASS } from '@shared/entry-types'
import type { HypothesisStatus } from '@shared/ipc-types'
import { Modal } from '@shared/Modal'

interface Props {
  finding: JournalEntry
  hypotheses: JournalEntry[]
  linkedHypothesisIds: Set<string>
  onClose: () => void
}

export function LinkHypothesisModal({ finding, hypotheses, linkedHypothesisIds, onClose }: Props) {
  const [linkedIds, setLinkedIds] = useState(linkedHypothesisIds)

  const toggle = async (hypothesisId: string) => {
    try {
      if (linkedIds.has(hypothesisId)) {
        await window.electronAPI.unlinkHypothesisFinding(hypothesisId, finding.id)
        setLinkedIds((prev) => { const next = new Set(prev); next.delete(hypothesisId); return next })
      } else {
        await window.electronAPI.linkHypothesisFinding(hypothesisId, finding.id)
        setLinkedIds((prev) => new Set(prev).add(hypothesisId))
      }
    } catch (err) {
      console.error('[overlay] Failed to toggle hypothesis link:', err)
    }
  }

  return (
    <Modal onClose={onClose} className="p-4 w-80 max-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-100">Link to Finding</h3>
        <button
          onClick={onClose}
          className="no-drag text-gray-500 hover:text-gray-300 transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="text-xs text-gray-500 font-mono mb-3 truncate">
        {finding.body || '(no text)'}
      </div>
      {hypotheses.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-6 font-mono">
          No hypotheses in this investigation yet.
        </div>
      ) : (
        <div className="overflow-y-auto space-y-1.5">
          {hypotheses.map((h) => {
            const isLinked = linkedIds.has(h.id)
            const status = (h.hypothesis_status ?? 'open') as HypothesisStatus
            return (
              <button
                key={h.id}
                onClick={() => toggle(h.id)}
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
      )}
      <div className="mt-3 flex justify-end">
        <button
          onClick={onClose}
          className="no-drag text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
