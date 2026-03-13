import React, { useEffect, useState } from 'react'
import type { Investigation, JournalEntry } from '../../../../shared/ipc-types'
import { DetailsEntryList } from '../../details/components/DetailsEntryList'

interface Props {
  investigationId: string
  onBack: () => void
}

function formatDate(isoString: string): string {
  try {
    const normalized = isoString.endsWith('Z') ? isoString : isoString + 'Z'
    return new Date(normalized).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return isoString
  }
}

export function InvestigationDetails({ investigationId, onBack }: Props) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.electronAPI.listInvestigations(),
      window.electronAPI.listEntries(investigationId)
    ]).then(([allInvestigations, allEntries]) => {
      setInvestigation(allInvestigations.find((i) => i.id === investigationId) ?? null)
      setEntries(allEntries)
    }).finally(() => setLoading(false))
  }, [investigationId])

  useEffect(() => {
    const unsubscribe = window.electronAPI.onInvestigationChanged((investigations) => {
      const found = investigations.find((i) => i.id === investigationId)
      if (found) {
        setInvestigation(found)
      } else {
        setInvestigation((prev) => prev ? { ...prev, is_active: 0 } : prev)
      }
    })
    return unsubscribe
  }, [investigationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm">Loading…</div>
    )
  }

  if (!investigation) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm">Investigation not found.</div>
    )
  }

  const isActive = investigation.is_active === 1

  return (
    <div className="flex flex-col gap-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-0.5 text-gray-400 hover:text-gray-200 text-sm transition-colors flex-shrink-0"
          title="Back to Investigations"
        >
          ← Back
        </button>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-100 truncate">{investigation.name}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              isActive
                ? 'bg-green-900/60 text-green-300 border border-green-700/50'
                : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'
            }`}>
              {isActive ? 'active' : 'inactive'}
            </span>
            <span className="text-xs text-gray-500">Created {formatDate(investigation.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Entry timeline */}
      <div>
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </div>
        <DetailsEntryList entries={entries} />
      </div>
    </div>
  )
}
