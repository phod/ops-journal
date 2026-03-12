import React from 'react'
import { useOverlayState } from './hooks/useOverlayState'
import { InvestigationBadge } from './components/InvestigationBadge'
import { EntryList } from './components/EntryList'
import { EntryInput } from './components/EntryInput'
import type { JournalEntry } from '../../shared/ipc-types'

export default function App() {
  const { activeInvestigation, entries, loading, addOptimisticEntry, updateEntry, deleteEntry } = useOverlayState()

  const handleEntryCreated = (entry: JournalEntry) => {
    addOptimisticEntry(entry)
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900/95 rounded-xl">
        <div className="text-gray-500 text-sm font-mono">Loading…</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-900/95 rounded-xl border border-gray-700/50 shadow-2xl overflow-hidden">
      {/* Drag handle / header */}
      <div className="drag-handle flex items-center justify-between px-3 py-2.5 border-b border-gray-700/50 bg-gray-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-500 font-mono flex-shrink-0">ops-journal</span>
          {activeInvestigation && (
            <>
              <span className="text-gray-600 text-xs flex-shrink-0">/</span>
              <InvestigationBadge investigation={activeInvestigation} />
            </>
          )}
        </div>
        <button
          onClick={() => window.electronAPI.hideOverlay()}
          className="no-drag text-gray-600 hover:text-gray-400 text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Main content */}
      {activeInvestigation === null ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-center">
            <div className="text-4xl mb-3">📋</div>
            <h2 className="text-gray-200 font-semibold text-base mb-1">No active investigation</h2>
            <p className="text-gray-500 text-sm font-mono leading-relaxed">
              Create an investigation to start capturing notes.
            </p>
          </div>
          <button
            onClick={() => window.electronAPI.openManager()}
            className="no-drag px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Open Investigation Manager
          </button>
        </div>
      ) : (
        <>
          <EntryList entries={entries} onEntryUpdated={updateEntry} onEntryDeleted={deleteEntry} />
          <EntryInput
            activeInvestigation={activeInvestigation}
            onEntryCreated={handleEntryCreated}
          />
        </>
      )}
    </div>
  )
}
