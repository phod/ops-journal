import React, { useState } from 'react'
import { useOverlayState } from './hooks/useOverlayState'
import { InvestigationBadge } from './components/InvestigationBadge'
import { EntryList } from './components/EntryList'
import { EntryInput } from './components/EntryInput'
import type { JournalEntry } from '@shared/ipc-types'
import { MAX_IMAGES_PER_ENTRY } from '@shared/ipc-types'

export default function App() {
  const { activeInvestigation, entries, loading, addOptimisticEntry, updateEntry, deleteEntry } = useOverlayState()
  const [isDragging, setIsDragging] = useState(false)
  const [pendingImages, setPendingImages] = useState<string[]>([])

  const handleEntryCreated = (entry: JournalEntry) => {
    addOptimisticEntry(entry)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    for (const file of files) {
      setPendingImages((prev) => {
        if (prev.length >= MAX_IMAGES_PER_ENTRY) return prev
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setPendingImages((p) => p.length < MAX_IMAGES_PER_ENTRY ? [...p, reader.result as string] : p)
          }
        }
        reader.readAsDataURL(file)
        return prev
      })
    }
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900/95 rounded-xl">
        <div className="text-gray-500 text-sm font-mono">Loading…</div>
      </div>
    )
  }

  return (
    <div
      className="w-full h-full flex flex-col bg-gray-900/95 rounded-xl border border-gray-700/50 shadow-2xl overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-indigo-950/60 border-2 border-indigo-400 border-dashed pointer-events-none">
          <span className="text-indigo-300 text-sm font-mono">Drop image to attach</span>
        </div>
      )}

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
            pendingImages={pendingImages}
            onPendingImagesChange={setPendingImages}
          />
        </>
      )}
    </div>
  )
}
