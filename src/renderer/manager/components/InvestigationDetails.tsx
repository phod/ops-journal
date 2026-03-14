import { useEffect, useMemo, useRef, useState } from 'react'
import type { Investigation, JournalEntry } from '@shared/ipc-types'
import { DetailsEntryList } from '../../details/components/DetailsEntryList'
import { SummaryView } from '../../details/components/SummaryView'
import type { SummaryViewHandle } from '../../details/components/SummaryView'
import { formatDate } from '@shared/format-date'
import { countEntries, filterEntries, type Filter } from '@shared/entry-types'

interface Props {
  investigationId: string
  onBack: () => void
}

export function InvestigationDetails({ investigationId, onBack }: Props) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<'entries' | 'summary' | null>(null)
  const summaryRef = useRef<SummaryViewHandle>(null)

  function navigateTo(target: 'summary' | 'entries', newFilter?: Filter): void {
    if (view === target && target === 'entries') {
      if (newFilter) setFilter(newFilter)
      return
    }
    if (view === 'summary' && target !== 'summary') {
      if (!summaryRef.current?.confirmIfDirty()) return
    }
    setView(target)
    if (newFilter) setFilter(newFilter)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.electronAPI.listInvestigations(),
      window.electronAPI.listEntries(investigationId),
      window.electronAPI.getSummary(investigationId)
    ]).then(([allInvestigations, allEntries, summaryJson]) => {
      setInvestigation(allInvestigations.find((i) => i.id === investigationId) ?? null)
      setEntries(allEntries)
      setView(summaryJson ? 'summary' : 'entries')
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

  const counts = useMemo(() => countEntries(entries), [entries])
  const filteredEntries = useMemo(() => filterEntries(entries, filter), [entries, filter])

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

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'images', label: 'Images' },
    { key: 'finding', label: 'Findings' },
    { key: 'action', label: 'Actions' },
    { key: 'hypothesis', label: 'Hypotheses' }
  ]

  return (
    <div className={`flex flex-col gap-6 ${view === 'summary' ? 'flex-1 min-h-0' : ''}`}>
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => { if (summaryRef.current?.confirmIfDirty() !== false) onBack() }}
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
            <span className="text-xs text-gray-500">
              Created {formatDate(investigation.created_at, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs + content */}
      <div className={view === 'summary' ? 'flex flex-col flex-1 min-h-0' : undefined}>
        <div className="flex items-center gap-1 mb-3 border-b border-gray-700/50">
          <button
            onClick={() => navigateTo('summary')}
            className={`text-xs px-3 py-1.5 rounded-t font-medium transition-colors ${
              view === 'summary'
                ? 'bg-gray-700 text-gray-100 border border-b-0 border-gray-600'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Summary
          </button>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => navigateTo('entries', key)}
              className={`text-xs px-3 py-1.5 rounded-t font-medium transition-colors ${
                view === 'entries' && filter === key
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
        </div>
        {view === 'summary' ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <SummaryView ref={summaryRef} investigationId={investigationId} />
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            </div>
            <DetailsEntryList entries={filteredEntries} allEntries={entries} onEntryUpdated={(updated) => setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e))} />
          </>
        )}
      </div>
    </div>
  )
}
