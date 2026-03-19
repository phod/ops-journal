import React, { useState, useCallback } from 'react'
import { useOverlayState } from './hooks/useOverlayState'
import { TabBar } from './components/TabBar'
import { EntryList } from './components/EntryList'
import { EntryInput } from './components/EntryInput'
import { EntityPanel } from './components/EntityPanel'
import { ResizeHandle } from './components/ResizeHandle'
import { RumourBoardView } from '../details/components/board/RumourBoardView'
import { MAX_IMAGES_PER_ENTRY } from '@shared/ipc-types'

const MIN_ENTRY_STREAM_WIDTH = 200
const DEFAULT_ENTRY_STREAM_WIDTH = 288
const MIN_ENTITY_PANEL_WIDTH = 120
const DEFAULT_ENTITY_PANEL_WIDTH = 176

export default function App() {
  const {
    activeInvestigations,
    currentInvestigation,
    currentInvestigationId,
    entries,
    loading,
    switchToInvestigation,
    addOptimisticEntry,
    updateEntry,
    deleteEntry
  } = useOverlayState()
  const [isDragging, setIsDragging] = useState(false)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [showEntityPanel, setShowEntityPanel] = useState(false)
  const [showRumourBoard, setShowRumourBoard] = useState(false)
  const [showEntryStream, setShowEntryStream] = useState(true)
  const [entryStreamWidth, setEntryStreamWidth] = useState(DEFAULT_ENTRY_STREAM_WIDTH)
  const [entityPanelWidth, setEntityPanelWidth] = useState(DEFAULT_ENTITY_PANEL_WIDTH)

  const handleEntryStreamResize = useCallback((delta: number) => {
    setEntryStreamWidth((w) => Math.max(MIN_ENTRY_STREAM_WIDTH, w - delta))
  }, [])

  const handleEntityPanelResize = useCallback((delta: number) => {
    setEntityPanelWidth((w) => Math.max(MIN_ENTITY_PANEL_WIDTH, w - delta))
  }, [])

  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')

  const handleDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const imageFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    for (const file of imageFiles) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPendingImages((prev) =>
            prev.length < MAX_IMAGES_PER_ENTRY ? [...prev, reader.result as string] : prev
          )
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateInvestigation = async (name: string) => {
    const inv = await window.electronAPI.createInvestigation(name)
    await window.electronAPI.setActiveInvestigation(inv.id)
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900/95 rounded-xl">
        <div className="text-gray-500 text-sm font-mono">Loading…</div>
      </div>
    )
  }

  function renderMainContent(): React.ReactNode {
    if (activeInvestigations.length === 0) {
      return (
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
      )
    }

    if (currentInvestigation === null) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm font-mono">Select a tab above</div>
        </div>
      )
    }

    const entryStream = (
      <div
        className="flex flex-col overflow-hidden flex-shrink-0"
        style={showRumourBoard ? { width: entryStreamWidth } : undefined}
      >
        <EntryList
          entries={entries}
          editingEntryId={editingEntryId}
          onEditingEntryIdChange={setEditingEntryId}
          onEntryUpdated={updateEntry}
          onEntryDeleted={deleteEntry}
        />
        <EntryInput
          activeInvestigation={currentInvestigation}
          entries={entries}
          editingEntryId={editingEntryId}
          onSetEditingEntryId={setEditingEntryId}
          onEntryCreated={addOptimisticEntry}
          pendingImages={pendingImages}
          onPendingImagesChange={setPendingImages}
        />
      </div>
    )

    const entityPanel = showEntityPanel && (
      <>
        <ResizeHandle onResize={handleEntityPanelResize} />
        <div className="flex-shrink-0 overflow-hidden" style={{ width: entityPanelWidth }}>
          <EntityPanel
            entries={entries}
            onClose={() => setShowEntityPanel(false)}
          />
        </div>
      </>
    )

    if (showRumourBoard) {
      return (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            <RumourBoardView investigationId={currentInvestigation.id} entries={entries} />
          </div>
          {showEntryStream && (
            <>
              <ResizeHandle onResize={handleEntryStreamResize} />
              {entryStream}
            </>
          )}
          {entityPanel}
        </div>
      )
    }

    return (
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <EntryList
            entries={entries}
            editingEntryId={editingEntryId}
            onEditingEntryIdChange={setEditingEntryId}
            onEntryUpdated={updateEntry}
            onEntryDeleted={deleteEntry}
          />
          <EntryInput
            activeInvestigation={currentInvestigation}
            entries={entries}
            editingEntryId={editingEntryId}
            onSetEditingEntryId={setEditingEntryId}
            onEntryCreated={addOptimisticEntry}
            pendingImages={pendingImages}
            onPendingImagesChange={setPendingImages}
          />
        </div>
        {entityPanel}
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
        <span className="text-xs text-gray-500 font-mono flex-shrink-0">ops-journal</span>
        <div className="flex items-center gap-1">
          {currentInvestigation && (
            <>
              <button
                onClick={() => {
                  const opening = !showRumourBoard
                  setShowRumourBoard(opening)
                  if (opening) {
                    setShowEntryStream(true)
                    window.electronAPI.expandOverlayForBoard()
                  } else {
                    window.electronAPI.restoreOverlayFromBoard()
                  }
                }}
                className={`no-drag text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0 font-bold ${
                  showRumourBoard
                    ? 'text-amber-300 bg-amber-500/25'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
                title="Toggle Rumour Board"
              >
                ⊞
              </button>
              {showRumourBoard && (
                <button
                  onClick={() => setShowEntryStream((v) => !v)}
                  className={`no-drag text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                    showEntryStream
                      ? 'text-amber-300 bg-amber-500/25'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                  title={showEntryStream ? 'Hide Entry Stream' : 'Show Entry Stream'}
                >
                  {showEntryStream ? '⫿' : '⫿'}
                </button>
              )}
              <button
                onClick={() => setShowEntityPanel((v) => !v)}
                className={`no-drag text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                  showEntityPanel
                    ? 'text-indigo-300 bg-indigo-500/20'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
                title="Toggle Entity Panel"
              >
                ☰
              </button>
              <button
                onClick={() => window.electronAPI.openDetails(currentInvestigation.id)}
                className="no-drag text-gray-600 hover:text-gray-400 text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
                title="Open Investigation Details"
              >
                ↗
              </button>
            </>
          )}
          <button
            onClick={() => window.electronAPI.openManager()}
            className="no-drag text-gray-600 hover:text-gray-400 text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
            title="Open Investigation Manager"
          >
            ⚙
          </button>
          <button
            onClick={() => window.electronAPI.hideOverlay()}
            className="no-drag text-gray-600 hover:text-gray-400 text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      <TabBar
        investigations={activeInvestigations}
        currentId={currentInvestigationId}
        onSelect={switchToInvestigation}
        onDeactivate={(id) => window.electronAPI.deactivateInvestigation(id)}
        onCreate={handleCreateInvestigation}
        onRename={(id, name) => window.electronAPI.renameInvestigation(id, name)}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-indigo-950/60 border-2 border-indigo-400 border-dashed pointer-events-none">
          <span className="text-indigo-300 text-sm font-mono">Drop image to attach</span>
        </div>
      )}

      {renderMainContent()}
    </div>
  )
}
