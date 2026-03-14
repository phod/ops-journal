import { useEffect, useMemo, useState } from 'react'
import type { Investigation, JournalEntry } from '@shared/ipc-types'
import { formatDate } from '@shared/format-date'
import { countEntries, filterEntries, type Filter } from '@shared/entry-types'
import { DetailsEntryList } from './components/DetailsEntryList'
import { SummaryView } from './components/SummaryView'

export default function App(): JSX.Element {
  const investigationId = new URLSearchParams(window.location.search).get('id')

  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<'entries' | 'summary'>('entries')

  useEffect(() => {
    if (!investigationId) {
      setLoading(false)
      return
    }

    async function load(): Promise<void> {
      const [allInvestigations, allEntries] = await Promise.all([
        window.electronAPI.listInvestigations(),
        window.electronAPI.listEntries(investigationId!)
      ])
      setInvestigation(allInvestigations.find((i) => i.id === investigationId) ?? null)
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
        setInvestigation((prev) => (prev ? { ...prev, is_active: 0 } : prev))
      }
    })
    return unsubscribe
  }, [investigationId])

  const counts = useMemo(() => countEntries(entries), [entries])
  const filteredEntries = useMemo(() => filterEntries(entries, filter), [entries, filter])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500 text-sm font-mono">Loading...</div>
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
  const statusClass = isActive
    ? 'bg-green-900/60 text-green-300 border border-green-700/50'
    : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'images', label: 'Images' },
    { key: 'finding', label: 'Findings' },
    { key: 'action', label: 'Actions' },
    { key: 'hypothesis', label: 'Hypotheses' }
  ]

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-700/50 bg-gray-800/40">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-100 truncate">
            {investigation.name}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusClass}`}>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-b border-gray-700/50 bg-gray-800/20">
        {view === 'entries' && tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs px-3 py-1.5 rounded-t font-medium transition-colors ${
              filter === key
                ? 'bg-gray-700 text-gray-100 border border-b-0 border-gray-600'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className="ml-1.5 text-gray-500">{counts[key]}</span>
            )}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setView(view === 'summary' ? 'entries' : 'summary')}
            className={`text-xs px-3 py-1.5 rounded-t font-medium transition-colors ${
              view === 'summary'
                ? 'bg-gray-700 text-gray-100 border border-b-0 border-gray-600'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Summary
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {view === 'summary' ? (
          <SummaryView investigationId={investigationId} />
        ) : (
          <div className="max-w-2xl">
            <div className="text-xs text-gray-500 font-mono mb-3 uppercase tracking-wider">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            </div>
            <DetailsEntryList entries={filteredEntries} allEntries={entries} onEntryUpdated={(updated) => setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e))} />
          </div>
        )}
      </div>
    </div>
  )
}
