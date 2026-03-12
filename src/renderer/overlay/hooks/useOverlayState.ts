import { useState, useEffect, useCallback } from 'react'
import type { Investigation, JournalEntry } from '../../../shared/ipc-types'

interface OverlayState {
  activeInvestigation: Investigation | null
  entries: JournalEntry[]
  loading: boolean
  addOptimisticEntry: (entry: JournalEntry) => void
  updateEntry: (updated: JournalEntry) => void
  deleteEntry: (id: string) => void
  refreshEntries: (investigationId: string) => Promise<void>
}

export function useOverlayState(): OverlayState {
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async (investigationId: string) => {
    try {
      const fetched = await window.electronAPI.listEntries(investigationId)
      setEntries(fetched)
    } catch (err) {
      console.error('[overlay] Failed to fetch entries:', err)
      setEntries([])
    }
  }, [])

  const refreshEntries = useCallback(
    async (investigationId: string) => {
      await fetchEntries(investigationId)
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
        const investigation = await window.electronAPI.getActiveInvestigation()
        if (cancelled) return
        setActiveInvestigation(investigation)

        if (investigation) {
          await fetchEntries(investigation.id)
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
      async (investigation: Investigation | null) => {
        setActiveInvestigation(investigation)
        if (investigation) {
          await fetchEntries(investigation.id)
        } else {
          setEntries([])
        }
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

  return { activeInvestigation, entries, loading, addOptimisticEntry, updateEntry, deleteEntry, refreshEntries }
}
