import { useState } from 'react'
import type { JournalEntry } from '@shared/ipc-types'

interface Props {
  hypothesis: JournalEntry
  findings: JournalEntry[]
  onClose: () => void
  onHypothesisUpdated: (entry: JournalEntry) => void
}

export function LinkFindingModal({ hypothesis, findings, onClose, onHypothesisUpdated }: Props) {
  const [current, setCurrent] = useState(hypothesis)
  const linkedIds = new Set(current.linked_finding_ids ?? [])

  const toggle = async (findingId: string) => {
    try {
      const updated = linkedIds.has(findingId)
        ? await window.electronAPI.unlinkHypothesisFinding(current.id, findingId)
        : await window.electronAPI.linkHypothesisFinding(current.id, findingId)
      setCurrent(updated)
    } catch (err) {
      console.error('[overlay] Failed to toggle finding link:', err)
    }
  }

  const handleClose = () => {
    onHypothesisUpdated(current)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 w-80 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-100">Link Findings</h3>
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
        {findings.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-6 font-mono">
            No findings in this investigation yet.
          </div>
        ) : (
          <div className="overflow-y-auto space-y-1.5">
            {findings.map((finding) => {
              const isLinked = linkedIds.has(finding.id)
              return (
                <button
                  key={finding.id}
                  onClick={() => toggle(finding.id)}
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
        )}
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleClose}
            className="no-drag text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
