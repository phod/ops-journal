import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { getValidTargetIds } from '@shared/link-drag-utils'

interface EntryDragState {
  draggedEntry: JournalEntry | null
  validTargetIds: Set<string>
  hoveredTargetId: string | null
  startDrag: (entry: JournalEntry) => void
  endDrag: () => void
  setHoveredTarget: (id: string | null) => void
}

const EMPTY_SET = new Set<string>()

const EntryDragContext = createContext<EntryDragState>({
  draggedEntry: null,
  validTargetIds: EMPTY_SET,
  hoveredTargetId: null,
  startDrag: () => {},
  endDrag: () => {},
  setHoveredTarget: () => {}
})

export function EntryDragProvider({ entries, children }: { entries: JournalEntry[]; children: React.ReactNode }) {
  const [draggedEntry, setDraggedEntry] = useState<JournalEntry | null>(null)
  const [validTargetIds, setValidTargetIds] = useState<Set<string>>(EMPTY_SET)
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  const startDrag = useCallback((entry: JournalEntry) => {
    setDraggedEntry(entry)
    setValidTargetIds(getValidTargetIds(entry, entriesRef.current))
  }, [])

  const endDrag = useCallback(() => {
    setDraggedEntry(null)
    setValidTargetIds(EMPTY_SET)
    setHoveredTargetId(null)
  }, [])

  const setHovered = useCallback((id: string | null) => {
    setHoveredTargetId(id)
  }, [])

  return (
    <EntryDragContext.Provider value={{ draggedEntry, validTargetIds, hoveredTargetId, startDrag, endDrag, setHoveredTarget: setHovered }}>
      {children}
    </EntryDragContext.Provider>
  )
}

export function useEntryDrag() {
  return useContext(EntryDragContext)
}
