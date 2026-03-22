import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { Investigation, JournalEntry } from '@shared/ipc-types'
import { DetailsEntryList } from '../../details/components/DetailsEntryList'
import { SummaryView } from '../../details/components/SummaryView'
import type { SummaryViewHandle } from '../../details/components/SummaryView'
import { ExportView } from '../../details/components/ExportView'
import { RumourBoardView } from '../../details/components/board/RumourBoardView'
import { RelationshipMapView } from '../../details/components/relationships/RelationshipMapView'
import { formatDate } from '@shared/format-date'
import { countEntries, filterEntries, type Filter } from '@shared/entry-types'

export interface InvestigationDetailsHandle {
  confirmIfDirty: () => boolean
}

interface Props {
  investigationId: string
  onBack: () => void
}

export const InvestigationDetails = forwardRef<InvestigationDetailsHandle, Props>(function InvestigationDetails({ investigationId, onBack }, ref) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<'entries' | 'summary' | 'export' | 'board' | 'relationships' | null>(null)
  const [preExportView, setPreExportView] = useState<'entries' | 'summary' | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const summaryRef = useRef<SummaryViewHandle>(null)

  const confirmIfDirty = useCallback((): boolean => {
    return summaryRef.current?.confirmIfDirty() ?? true
  }, [])

  useImperativeHandle(ref, () => ({ confirmIfDirty }), [confirmIfDirty])

  const startRenaming = useCallback(() => {
    if (!investigation) return
    setRenameValue(investigation.name)
    setIsRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [investigation])

  const commitRename = useCallback(async () => {
    if (investigation && renameValue.trim() && renameValue.trim() !== investigation.name) {
      const updated = await window.electronAPI.renameInvestigation(investigation.id, renameValue.trim())
      setInvestigation(updated)
    }
    setIsRenaming(false)
    setRenameValue('')
  }, [investigation, renameValue])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitRename()
      } else if (e.key === 'Escape') {
        setIsRenaming(false)
        setRenameValue('')
      }
    },
    [commitRename]
  )

  function openExport(): void {
    if (view === 'summary' && !summaryRef.current?.confirmIfDirty()) return
    setPreExportView((view === 'summary' || view === 'entries') ? view : 'entries')
    setView('export')
  }

  function navigateTo(target: 'summary' | 'entries' | 'board' | 'relationships', newFilter?: Filter): void {
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

  useEffect(() => {
    const unsubscribe = window.electronAPI.onEntriesChanged(
      (changedInvestigationId, updatedEntries) => {
        if (changedInvestigationId === investigationId) {
          setEntries(updatedEntries)
        }
      }
    )
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
    { key: 'flagged', label: 'Flagged' },
    { key: 'images', label: 'Images' },
    { key: 'finding', label: 'Findings' },
    { key: 'action', label: 'Actions' },
    { key: 'hypothesis', label: 'Hypotheses' },
    { key: 'tool', label: 'Tools' }
  ]

  return (
    <div className={`flex flex-col gap-6 ${['summary', 'board', 'relationships'].includes(view) ? 'flex-1 min-h-0' : ''}`}>
      {/* Back + header — hidden when in export view */}
      {view !== 'export' && <div className="grid grid-cols-[1fr_auto_1fr] items-start">
        <button
          onClick={() => { if (summaryRef.current?.confirmIfDirty() !== false) onBack() }}
          className="mt-0.5 text-gray-400 hover:text-gray-200 text-sm transition-colors justify-self-start"
          data-tooltip="Back to Investigations"
        >
          ← Back
        </button>
        <div className="text-center">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={commitRename}
              className="text-xl font-semibold text-gray-100 bg-gray-700/60 rounded px-2 py-0.5 outline-none border border-indigo-500/50 text-center"
            />
          ) : (
            <h2
              className="text-xl font-semibold text-gray-100 cursor-pointer hover:text-indigo-300 transition-colors"
              onClick={startRenaming}
              data-tooltip="Click to rename"
            >
              {investigation.name}
            </h2>
          )}
          <div className="flex items-center justify-center gap-2 mt-1.5">
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
        <div className="flex gap-2 mt-0.5 justify-self-end">
          <button
            onClick={() => window.electronAPI.showOverlay()}
            className="text-xs px-2.5 py-1 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
            data-tooltip="Open overlay"
          >
            Open overlay
          </button>
          <button
            onClick={openExport}
            className="text-xs px-2.5 py-1 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
            data-tooltip="Export investigation"
          >
            Export
          </button>
        </div>
      </div>}

      {/* Export view (full replacement) */}
      {view === 'export' && (
        <ExportView
          investigationId={investigationId}
          investigationName={investigation.name}
          entries={entries}
          onBack={() => setView(preExportView ?? 'entries')}
        />
      )}

      {/* Tabs + content */}
      <div className={['summary', 'board', 'relationships'].includes(view) ? 'flex flex-col flex-1 min-h-0' : undefined} style={{ display: view === 'export' ? 'none' : undefined }}>
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
          <button
            onClick={() => navigateTo('board')}
            className={`text-xs px-3 py-1.5 rounded-t font-medium transition-colors ${
              view === 'board'
                ? 'bg-gray-700 text-gray-100 border border-b-0 border-gray-600'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Rumour Board
          </button>
          <button
            onClick={() => navigateTo('relationships')}
            className={`text-xs px-3 py-1.5 rounded-t font-medium transition-colors ${
              view === 'relationships'
                ? 'bg-gray-700 text-gray-100 border border-b-0 border-gray-600'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Relationships
          </button>
        </div>
        {view === 'relationships' ? (
          <div className="flex-1 min-h-0 flex -mx-6 -mb-6">
            <RelationshipMapView entries={entries} />
          </div>
        ) : view === 'board' ? (
          <div className="flex-1 min-h-0 flex -mx-6 -mb-6">
            <RumourBoardView investigationId={investigationId} entries={entries} />
          </div>
        ) : view === 'summary' ? (
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
})
