import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useOverlayState } from './hooks/useOverlayState'
import { TabBar } from './components/TabBar'
import { EntryList } from './components/EntryList'
import { EntryInput } from './components/EntryInput'
import { EntityPanel } from './components/EntityPanel'
import { ResizeHandle } from './components/ResizeHandle'
import { SearchPanel } from './components/SearchPanel'
import { RumourBoardView } from '../details/components/board/RumourBoardView'
import { RelationshipMapView } from '../details/components/relationships/RelationshipMapView'
import { EntryDragProvider } from './contexts/EntryDragContext'
import { MAX_IMAGES_PER_ENTRY } from '@shared/ipc-types'
import { Modal } from '@shared/Modal'

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
    updateEntry,
    deleteEntry
  } = useOverlayState()
  const [isDragging, setIsDragging] = useState(false)
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null)
  const [opaqueOverlay, setOpaqueOverlay] = useState(false)

  useEffect(() => {
    window.electronAPI.getOpaqueOverlay().then(setOpaqueOverlay)
    return window.electronAPI.onOpaqueOverlayChanged(setOpaqueOverlay)
  }, [])
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [showEntityPanel, setShowEntityPanel] = useState(false)
  const [showRumourBoard, setShowRumourBoard] = useState(false)
  const [showRelationshipMap, setShowRelationshipMap] = useState(false)
  const [showEntryStream, setShowEntryStream] = useState(true)
  const [entryStreamWidth, setEntryStreamWidth] = useState(DEFAULT_ENTRY_STREAM_WIDTH)
  const [entityPanelWidth, setEntityPanelWidth] = useState(DEFAULT_ENTITY_PANEL_WIDTH)
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null)
  const [searchPanelWidth, setSearchPanelWidth] = useState(220)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const onboardingCheckedRef = useRef(false)

  // Cmd+F to toggle search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        if (!showSearch) {
          setShowSearch(true)
          if (!showRumourBoard && !showRelationshipMap) window.electronAPI.expandOverlayForSearch()
          setTimeout(() => searchInputRef.current?.focus(), 0)
        }
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
        setSearchTerm('')
        setHighlightedEntryId(null)
        if (!showRumourBoard && !showRelationshipMap) window.electronAPI.restoreOverlayFromSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSearch, showRumourBoard, showRelationshipMap])

  // Check onboarding on first investigation
  useEffect(() => {
    if (onboardingCheckedRef.current || activeInvestigations.length === 0) return
    onboardingCheckedRef.current = true
    window.electronAPI.getOnboardingDismissed().then((dismissed) => {
      if (!dismissed) setShowOnboarding(true)
    })
  }, [activeInvestigations])

  // Listen for onboarding reset from Settings
  useEffect(() => {
    return window.electronAPI.onOnboardingReset(() => {
      setShowOnboarding(true)
    })
  }, [])

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false)
    window.electronAPI.setOnboardingDismissed(true)
  }, [])

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries
    const term = searchTerm.toLowerCase()
    return entries.filter((e) => e.body.toLowerCase().includes(term))
  }, [entries, searchTerm])

  const handleEntryStreamResize = useCallback((delta: number) => {
    setEntryStreamWidth((w) => Math.max(MIN_ENTRY_STREAM_WIDTH, w - delta))
  }, [])

  const handleEntityPanelResize = useCallback((delta: number) => {
    setEntityPanelWidth((w) => Math.max(MIN_ENTITY_PANEL_WIDTH, w - delta))
  }, [])

  const handleSearchPanelResize = useCallback((delta: number) => {
    setSearchPanelWidth((w) => Math.max(160, w + delta))
  }, [])

  const closeSearch = useCallback(() => {
    setShowSearch(false)
    setSearchTerm('')
    setHighlightedEntryId(null)
    if (!showRumourBoard && !showRelationshipMap) window.electronAPI.restoreOverlayFromSearch()
  }, [showRumourBoard, showRelationshipMap])

  const handleSearchResultClick = useCallback((entryId: string) => {
    setHighlightedEntryId(entryId)
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
    switchToInvestigation(inv.id)
  }

  if (loading) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${opaqueOverlay ? 'bg-gray-900/95' : 'bg-gray-900'} rounded-xl`}>
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

    const searchBar = showSearch && (
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-700/50 bg-gray-800/40">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 flex-shrink-0">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowSearch(false); setSearchTerm('') } }}
          placeholder="Search entries…"
          className="flex-1 text-xs bg-transparent text-gray-200 outline-none font-mono placeholder-gray-600"
        />
        {searchTerm && (
          <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'result' : 'results'}
          </span>
        )}
        <button
          onClick={() => { setShowSearch(false); setSearchTerm('') }}
          className="text-gray-500 hover:text-gray-300 text-xs px-0.5"
          title="Close search (Esc)"
        >
          ✕
        </button>
      </div>
    )

    const entryStream = (
      <div
        className="flex flex-col overflow-hidden flex-shrink-0"
        style={showRumourBoard || showRelationshipMap ? { width: entryStreamWidth } : undefined}
      >
        {searchBar}
        <EntryList
          entries={filteredEntries}
          editingEntryId={editingEntryId}
          onEditingEntryIdChange={setEditingEntryId}
          onEntryUpdated={updateEntry}
          onEntryDeleted={deleteEntry}
          searchTerm={searchTerm}
        />
        <EntryInput
          activeInvestigation={currentInvestigation}
          entries={entries}
          editingEntryId={editingEntryId}
          onSetEditingEntryId={setEditingEntryId}
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
            onEntryUpdated={updateEntry}
          />
        </div>
      </>
    )

    if (showRelationshipMap) {
      return (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            <RelationshipMapView entries={entries} />
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

    if (showRumourBoard) {
      return (
        <EntryDragProvider entries={entries}>
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
        </EntryDragProvider>
      )
    }

    return (
      <EntryDragProvider entries={entries}>
        <div className="flex flex-1 overflow-hidden">
          {showSearch && (
            <>
              <div className="flex-shrink-0 overflow-hidden" style={{ width: searchPanelWidth }}>
                <SearchPanel
                  entries={entries}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  onResultClick={handleSearchResultClick}
                  onClose={closeSearch}
                  searchInputRef={searchInputRef}
                />
              </div>
              <ResizeHandle onResize={handleSearchPanelResize} />
            </>
          )}
          <div className="flex flex-col flex-1 overflow-hidden">
            {showOnboarding && !showSearch && (
              <div className="mx-3 mt-2 p-3 rounded-lg bg-indigo-950/50 border border-indigo-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Quick Tips</span>
                  <button onClick={dismissOnboarding} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Don't show again</button>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-300 font-mono">
                  <li><span className="text-indigo-400">/action</span>, <span className="text-indigo-400">/finding</span>, <span className="text-indigo-400">/hypothesis</span> — categorize entries with slash commands</li>
                  <li>Click the <span className="text-amber-400">flag icon</span> to mark important entries</li>
                  <li>Use the <span className="text-indigo-400">↗</span> button to open the details view for summaries and export</li>
                  <li>Configure your hotkeys in <span className="text-indigo-400">⚙ Settings</span></li>
                </ul>
              </div>
            )}
            <EntryList
              entries={entries}
              editingEntryId={editingEntryId}
              onEditingEntryIdChange={setEditingEntryId}
              onEntryUpdated={updateEntry}
              onEntryDeleted={deleteEntry}
              searchTerm={showSearch ? searchTerm : undefined}
              highlightedEntryId={highlightedEntryId}
            />
            <EntryInput
              activeInvestigation={currentInvestigation}
              entries={entries}
              editingEntryId={editingEntryId}
              onSetEditingEntryId={setEditingEntryId}
              pendingImages={pendingImages}
              onPendingImagesChange={setPendingImages}
            />
          </div>
          {entityPanel}
        </div>
      </EntryDragProvider>
    )
  }

  return (
    <div
      className={`w-full h-full flex flex-col ${opaqueOverlay ? 'bg-gray-900/95' : 'bg-gray-900'} rounded-xl border border-gray-700/50 shadow-2xl overflow-hidden`}
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
                    setShowRelationshipMap(false)
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
              <button
                onClick={() => {
                  const opening = !showRelationshipMap
                  setShowRelationshipMap(opening)
                  if (opening) {
                    setShowRumourBoard(false)
                    setShowEntryStream(true)
                    window.electronAPI.expandOverlayForBoard()
                  } else {
                    window.electronAPI.restoreOverlayFromBoard()
                  }
                }}
                className={`no-drag text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0 font-bold ${
                  showRelationshipMap
                    ? 'text-indigo-300 bg-indigo-500/20'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
                title="Toggle Relationship Map"
              >
                ◈
              </button>
              {(showRumourBoard || showRelationshipMap) && (
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
              <button
                onClick={() => {
                  if (!showSearch) {
                    setShowSearch(true)
                    if (!showRumourBoard && !showRelationshipMap) window.electronAPI.expandOverlayForSearch()
                    setTimeout(() => searchInputRef.current?.focus(), 0)
                  } else {
                    closeSearch()
                  }
                }}
                className={`no-drag text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                  showSearch
                    ? 'text-indigo-300 bg-indigo-500/20'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
                title="Search entries (⌘F)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
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
        onDeactivate={(id) => setDeactivateConfirmId(id)}
        onCreate={handleCreateInvestigation}
        onRename={(id, name) => window.electronAPI.renameInvestigation(id, name)}
        onReorder={(orderedIds) => window.electronAPI.reorderInvestigations(orderedIds)}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-indigo-950/60 border-2 border-indigo-400 border-dashed pointer-events-none">
          <span className="text-indigo-300 text-sm font-mono">Drop image to attach</span>
        </div>
      )}

      {renderMainContent()}

      {deactivateConfirmId && (
        <Modal onClose={() => setDeactivateConfirmId(null)} className="p-6 w-[340px]">
          <h3 className="text-gray-100 font-semibold text-sm mb-2">Close tab?</h3>
          <p className="text-gray-400 text-sm mb-5 leading-relaxed">
            This will deactivate the investigation. You can reactivate it later from the Investigation Manager.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeactivateConfirmId(null)}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                window.electronAPI.deactivateInvestigation(deactivateConfirmId)
                setDeactivateConfirmId(null)
              }}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            >
              Close tab
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
