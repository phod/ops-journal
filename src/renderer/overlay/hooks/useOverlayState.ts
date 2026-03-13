import { useState, useEffect, useCallback } from 'react'
import type { Investigation, JournalEntry } from '@shared/ipc-types'

interface OverlayState {
  activeInvestigations: Investigation[]
  currentInvestigationId: string | null
  currentInvestigation: Investigation | null
  entries: JournalEntry[]
  loading: boolean
  switchToInvestigation: (id: string) => void
  addOptimisticEntry: (entry: JournalEntry) => void
  updateEntry: (updated: JournalEntry) => void
  deleteEntry: (id: string) => void
  fetchEntries: (investigationId: string) => Promise<void>
}

export function useOverlayState(): OverlayState {
  const [activeInvestigations, setActiveInvestigations] = useState<Investigation[]>([])
  const [currentInvestigationId, setCurrentInvestigationId] = useState<string | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  const currentInvestigation = activeInvestigations.find((i) => i.id === currentInvestigationId) ?? null

  const fetchEntries = useCallback(async (investigationId: string) => {
    try {
      const fetched = await window.electronAPI.listEntries(investigationId)
      setEntries(fetched)
    } catch (err) {
      console.error('[overlay] Failed to fetch entries:', err)
      setEntries([])
    }
  }, [])

  const switchToInvestigation = useCallback(
    (id: string) => {
      setCurrentInvestigationId(id)
      fetchEntries(id)
    },
    [fetchEntries]
  )

  const addOptimisticEntry = useCallback((entry: JournalEntry) => {
    setEntries((prev) => [...prev, entry])
  }, [])

  const updateEntry = useCallback((updated: JournalEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // Initial load
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const investigations = await window.electronAPI.getActiveInvestigations()
        if (cancelled) return
        setActiveInvestigations(investigations)

        if (investigations.length > 0) {
          const firstId = investigations[0].id
          setCurrentInvestigationId(firstId)
          await fetchEntries(firstId)
        } else {
          setEntries([])
        }
      } catch (err) {
        console.error('[overlay] Init failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [fetchEntries])

  // Subscribe to push events
  useEffect(() => {
    const unsubscribe = window.electronAPI.onInvestigationChanged(
      (investigations: Investigation[]) => {
        setActiveInvestigations(investigations)
        setCurrentInvestigationId((currentId) => {
          const stillPresent = investigations.some((i) => i.id === currentId)
          if (!stillPresent) {
            const nextId = investigations.length > 0 ? investigations[0].id : null
            if (nextId) fetchEntries(nextId)
            else setEntries([])
            return nextId
          }
          // Current is still present — keep selection, don't re-fetch
          return currentId
        })
      }
    )

    return unsubscribe
  }, [fetchEntries])

  // Listen for Escape key to hide overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.hideOverlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    activeInvestigations,
    currentInvestigationId,
    currentInvestigation,
    entries,
    loading,
    switchToInvestigation,
    addOptimisticEntry,
    updateEntry,
    deleteEntry,
    fetchEntries
  }
}
