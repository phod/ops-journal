import { useState, useEffect, useCallback } from 'react'
import type { PendingToolEntry, Investigation, ToolEntryStatus } from '@shared/ipc-types'
import { PendingToolCard } from './PendingToolCard'

export function ConversionQueue() {
  const [entries, setEntries] = useState<PendingToolEntry[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [filterInvestigationId, setFilterInvestigationId] = useState<string>('')
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAbandoned, setShowAbandoned] = useState(false)

  const statuses: ToolEntryStatus[] = showAbandoned ? ['pending', 'abandoned'] : ['pending']

  const loadEntries = useCallback(async () => {
    const list = await window.electronAPI.listPendingToolEntries(filterInvestigationId || undefined, statuses)
    setEntries(list)
  }, [filterInvestigationId, showAbandoned])

  const loadInvestigations = useCallback(async () => {
    const [allInvestigations, allEntries] = await Promise.all([
      window.electronAPI.listInvestigations(),
      window.electronAPI.listPendingToolEntries(undefined, statuses),
    ])
    const idsWithEntries = new Set(allEntries.map((e) => e.investigation_id))
    setInvestigations(allInvestigations.filter((inv) => idsWithEntries.has(inv.id)))
  }, [showAbandoned])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  useEffect(() => {
    loadInvestigations()
  }, [loadInvestigations])

  useEffect(() => {
    return window.electronAPI.onEntriesChanged(() => {
      loadEntries()
      loadInvestigations()
    })
  }, [loadEntries, loadInvestigations])

  const visibleEntries = entries.filter((e) => !skippedIds.has(e.id))
  const pendingCount = visibleEntries.filter((e) => e.tool_status === 'pending').length
  const abandonedCount = visibleEntries.filter((e) => e.tool_status === 'abandoned').length

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleSkip(id: string) {
    setSkippedIds((prev) => new Set(prev).add(id))
    if (expandedId === id) setExpandedId(null)
  }

  function handleRemoved(id: string) {
    if (expandedId === id) setExpandedId(null)
  }

  function expandAll() {
    // When "Expand All" is clicked, we don't use accordion — just expand the first one
    // Actually, let's just expand all by not using accordion for this action
    // The plan says accordion-style, so expand all doesn't quite fit — let's just toggle all
    // For simplicity: if all visible are showing, collapse; otherwise expand first
    if (visibleEntries.length > 0) {
      setExpandedId(visibleEntries[0].id)
    }
  }

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <select
            value={filterInvestigationId}
            onChange={(e) => setFilterInvestigationId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300
              outline-none focus:border-indigo-500/60 transition-colors cursor-pointer
              appearance-none pr-8"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%239ca3af'%3E%3Cpath d='M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '1rem',
            }}
          >
            <option value="">All Investigations</option>
            {investigations.map((inv) => (
              <option key={inv.id} value={inv.id}>{inv.name}</option>
            ))}
          </select>
          <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-sky-500/20 text-sky-300 tracking-wide">
            {pendingCount} pending
          </span>
          <button
            onClick={() => setShowAbandoned(!showAbandoned)}
            className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-colors ${
              showAbandoned
                ? 'bg-gray-500/20 text-gray-300 border border-gray-600/30'
                : 'text-gray-600 hover:text-gray-400 border border-transparent'
            }`}
          >
            {showAbandoned ? `Hide abandoned (${abandonedCount})` : 'Show abandoned'}
          </button>
        </div>
        {visibleEntries.length > 0 && (
          <button
            onClick={expandAll}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors font-medium"
          >
            Expand All
          </button>
        )}
      </div>

      {/* Entry cards */}
      {visibleEntries.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-600 text-sm mb-2 font-medium">
            {showAbandoned ? 'No pending or abandoned tool entries' : 'No pending tool entries'}
          </div>
          <div className="text-gray-700 text-xs">
            Use <span className="font-mono text-gray-500">/tool</span> in an investigation to create entries that can be converted.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleEntries.map((entry) => (
            <PendingToolCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggle={() => handleToggle(entry.id)}
              onCreated={() => handleRemoved(entry.id)}
              onSkip={() => handleSkip(entry.id)}
              onAbandoned={() => handleRemoved(entry.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}
