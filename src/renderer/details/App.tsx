import React, { useEffect, useState } from 'react'
import type { Investigation, JournalEntry } from '@shared/ipc-types'
import { DetailsEntryList } from './components/DetailsEntryList'

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

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const investigationId = params.get('id')

  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!investigationId) {
      setLoading(false)
      return
    }

    async function load() {
      const [allInvestigations, allEntries] = await Promise.all([
        window.electronAPI.listInvestigations(),
        window.electronAPI.listEntries(investigationId!)
      ])
      const found = allInvestigations.find((i) => i.id === investigationId) ?? null
      setInvestigation(found)
      setEntries(allEntries)
      setLoading(false)
    }

    load()
  }, [investigationId])

  useEffect(() => {
    const unsubscribe = window.electronAPI.onInvestigationChanged((investigations) => {
      if (!investigationId) return
      const found = investigations.find((i) => i.id === investigationId)
      if (found) {
        setInvestigation(found)
      } else {
        // Investigation was deleted — update the local state to reflect it's gone
        setInvestigation((prev) => prev ? { ...prev, is_active: 0 } : prev)
      }
    })
    return unsubscribe
  }, [investigationId])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500 text-sm font-mono">Loading…</div>
      </div>
    )
  }

  if (!investigationId || !investigation) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500 text-sm font-mono">Investigation not found.</div>
      </div>
    )
  }

  const isActive = investigation.is_active === 1

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-700/50 bg-gray-800/40">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-100 truncate">
            {investigation.name}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              isActive
                ? 'bg-green-900/60 text-green-300 border border-green-700/50'
                : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'
            }`}>
              {isActive ? 'active' : 'inactive'}
            </span>
            <span className="text-xs text-gray-500">
              Created {formatDate(investigation.created_at)}
            </span>
          </div>
        </div>
        <button
          onClick={() => window.close()}
          className="text-gray-500 hover:text-gray-300 text-sm px-2 py-1 rounded transition-colors flex-shrink-0"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Entry timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl">
          <div className="text-xs text-gray-500 font-mono mb-3 uppercase tracking-wider">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </div>
          <DetailsEntryList entries={entries} />
        </div>
      </div>
    </div>
  )
}
