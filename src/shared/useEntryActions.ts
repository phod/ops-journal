import type { JournalEntry, EntryType, HypothesisStatus, ToolEntryStatus } from '@shared/ipc-types'

interface UseEntryActionsOptions {
  entry: JournalEntry
  onUpdated: (entry: JournalEntry) => void
  setShowTypeMenu?: (show: boolean) => void
  setShowStatusMenu?: (show: boolean) => void
}

export function useEntryActions({ entry, onUpdated, setShowTypeMenu, setShowStatusMenu }: UseEntryActionsOptions) {
  const changeType = async (newType: EntryType) => {
    setShowTypeMenu?.(false)
    if (newType === entry.type) return
    try {
      const updated = await window.electronAPI.updateEntry(entry.id, entry.body, undefined, newType)
      onUpdated(updated)
    } catch (err) {
      console.error('Failed to change entry type:', err)
    }
  }

  const changeHypothesisStatus = async (status: HypothesisStatus) => {
    setShowStatusMenu?.(false)
    try {
      const updated = await window.electronAPI.updateHypothesisStatus(entry.id, status)
      onUpdated(updated)
    } catch (err) {
      console.error('Failed to change hypothesis status:', err)
    }
  }

  const changeToolEntryStatus = async (status: ToolEntryStatus) => {
    setShowStatusMenu?.(false)
    try {
      const updated = await window.electronAPI.updateToolEntryStatus(entry.id, status)
      onUpdated(updated)
    } catch (err) {
      console.error('Failed to change tool entry status:', err)
    }
  }

  const toggleCompleted = async () => {
    try {
      const updated = await window.electronAPI.toggleActionCompleted(entry.id)
      onUpdated(updated)
    } catch (err) {
      console.error('Failed to toggle action completed:', err)
    }
  }

  const toggleFlagged = async () => {
    try {
      const updated = await window.electronAPI.toggleFlagged(entry.id)
      onUpdated(updated)
    } catch (err) {
      console.error('Failed to toggle flagged:', err)
    }
  }

  return { changeType, changeHypothesisStatus, changeToolEntryStatus, toggleCompleted, toggleFlagged }
}
