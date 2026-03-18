import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useOverlayState } from '../useOverlayState'
import type { Investigation, JournalEntry } from '@shared/ipc-types'

const inv1: Investigation = {
  id: 'inv-1',
  name: 'Outage Alpha',
  is_active: 1,
  created_at: '2024-01-01 10:00:00',
  entry_count: 2,
  last_entry_at: '2024-01-01 11:00:00'
}

const inv2: Investigation = {
  id: 'inv-2',
  name: 'Outage Beta',
  is_active: 1,
  created_at: '2024-01-02 10:00:00',
  entry_count: 0,
  last_entry_at: null
}

const entry1: JournalEntry = {
  id: 'e1',
  investigation_id: 'inv-1',
  body: 'First note',
  image_paths: [],
  created_at: '2024-01-01 10:01:00',
  type: 'note'
}

const entry2: JournalEntry = {
  id: 'e2',
  investigation_id: 'inv-1',
  body: 'Second note',
  image_paths: [],
  created_at: '2024-01-01 10:02:00',
  type: 'note'
}

describe('useOverlayState', () => {
  beforeEach(() => {
    window.electronAPI.getActiveInvestigations = vi.fn().mockResolvedValue([inv1, inv2])
    window.electronAPI.listEntries = vi.fn().mockResolvedValue([entry1, entry2])
    window.electronAPI.getLastViewedInvestigationId = vi.fn().mockResolvedValue(null)
    window.electronAPI.setLastViewedInvestigationId = vi.fn().mockResolvedValue(undefined)
    window.electronAPI.hideOverlay = vi.fn()
    window.electronAPI.onInvestigationChanged = vi.fn().mockReturnValue(() => {})
    window.electronAPI.onEntriesChanged = vi.fn().mockReturnValue(() => {})
  })

  it('initialises with loading true then loads investigations and entries', async () => {
    const { result } = renderHook(() => useOverlayState())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.activeInvestigations).toEqual([inv1, inv2])
    expect(result.current.currentInvestigationId).toBe('inv-1')
    expect(result.current.currentInvestigation).toEqual(inv1)
    expect(result.current.entries).toEqual([entry1, entry2])
  })

  it('resumes last viewed investigation if available', async () => {
    window.electronAPI.getLastViewedInvestigationId = vi.fn().mockResolvedValue('inv-2')
    window.electronAPI.listEntries = vi.fn().mockResolvedValue([])

    const { result } = renderHook(() => useOverlayState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.currentInvestigationId).toBe('inv-2')
  })

  it('falls back to first investigation if last viewed is not in active list', async () => {
    window.electronAPI.getLastViewedInvestigationId = vi.fn().mockResolvedValue('inv-gone')

    const { result } = renderHook(() => useOverlayState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.currentInvestigationId).toBe('inv-1')
  })

  it('handles no active investigations', async () => {
    window.electronAPI.getActiveInvestigations = vi.fn().mockResolvedValue([])

    const { result } = renderHook(() => useOverlayState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.activeInvestigations).toEqual([])
    expect(result.current.currentInvestigationId).toBeNull()
    expect(result.current.currentInvestigation).toBeNull()
    expect(result.current.entries).toEqual([])
  })

  it('switchToInvestigation fetches entries and persists selection', async () => {
    const { result } = renderHook(() => useOverlayState())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const newEntries: JournalEntry[] = []
    window.electronAPI.listEntries = vi.fn().mockResolvedValue(newEntries)

    await act(() => result.current.switchToInvestigation('inv-2'))

    expect(result.current.currentInvestigationId).toBe('inv-2')
    expect(window.electronAPI.listEntries).toHaveBeenCalledWith('inv-2')
    expect(window.electronAPI.setLastViewedInvestigationId).toHaveBeenCalledWith('inv-2')
  })

  it('addOptimisticEntry appends to entries', async () => {
    const { result } = renderHook(() => useOverlayState())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const newEntry: JournalEntry = {
      id: 'e3',
      investigation_id: 'inv-1',
      body: 'Optimistic',
      image_paths: [],
      created_at: '2024-01-01 10:03:00',
      type: 'note'
    }

    act(() => result.current.addOptimisticEntry(newEntry))

    expect(result.current.entries).toHaveLength(3)
    expect(result.current.entries[2]).toEqual(newEntry)
  })

  it('updateEntry replaces entry by ID', async () => {
    const { result } = renderHook(() => useOverlayState())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const updated = { ...entry1, body: 'Updated body' }
    act(() => result.current.updateEntry(updated))

    expect(result.current.entries[0].body).toBe('Updated body')
    expect(result.current.entries).toHaveLength(2)
  })

  it('deleteEntry removes entry by ID', async () => {
    const { result } = renderHook(() => useOverlayState())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.deleteEntry('e1'))

    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].id).toBe('e2')
  })

  it('subscribes to investigation changes and updates state', async () => {
    let investigationCallback: (investigations: Investigation[]) => void = () => {}
    window.electronAPI.onInvestigationChanged = vi.fn().mockImplementation((cb) => {
      investigationCallback = cb
      return () => {}
    })

    const { result } = renderHook(() => useOverlayState())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Simulate push: current investigation is removed
    const newEntries: JournalEntry[] = []
    window.electronAPI.listEntries = vi.fn().mockResolvedValue(newEntries)

    act(() => investigationCallback([inv2]))

    await waitFor(() => {
      expect(result.current.activeInvestigations).toEqual([inv2])
      expect(result.current.currentInvestigationId).toBe('inv-2')
    })
  })

  it('subscribes to entry changes for the current investigation', async () => {
    let entriesCallback: (investigationId: string, entries: JournalEntry[]) => void = () => {}
    window.electronAPI.onEntriesChanged = vi.fn().mockImplementation((cb) => {
      entriesCallback = cb
      return () => {}
    })

    const { result } = renderHook(() => useOverlayState())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const pushedEntries = [{ ...entry1, body: 'Pushed update' }]
    act(() => entriesCallback('inv-1', pushedEntries))

    expect(result.current.entries).toEqual(pushedEntries)
  })

  it('ignores entry changes for a different investigation', async () => {
    let entriesCallback: (investigationId: string, entries: JournalEntry[]) => void = () => {}
    window.electronAPI.onEntriesChanged = vi.fn().mockImplementation((cb) => {
      entriesCallback = cb
      return () => {}
    })

    const { result } = renderHook(() => useOverlayState())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => entriesCallback('inv-other', []))

    // Entries should remain unchanged
    expect(result.current.entries).toEqual([entry1, entry2])
  })

  it('hides overlay on Escape key', async () => {
    renderHook(() => useOverlayState())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(window.electronAPI.hideOverlay).toHaveBeenCalled()
  })

  it('handles init failure gracefully', async () => {
    window.electronAPI.getActiveInvestigations = vi.fn().mockRejectedValue(new Error('fail'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useOverlayState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    consoleSpy.mockRestore()
  })

  it('handles fetchEntries failure gracefully', async () => {
    window.electronAPI.getActiveInvestigations = vi.fn().mockResolvedValue([inv1])
    window.electronAPI.listEntries = vi.fn().mockRejectedValue(new Error('fail'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useOverlayState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.entries).toEqual([])
    consoleSpy.mockRestore()
  })

  it('cleans up subscriptions on unmount', async () => {
    const unsubInvestigation = vi.fn()
    const unsubEntries = vi.fn()
    window.electronAPI.onInvestigationChanged = vi.fn().mockReturnValue(unsubInvestigation)
    window.electronAPI.onEntriesChanged = vi.fn().mockReturnValue(unsubEntries)

    const { unmount } = renderHook(() => useOverlayState())
    await waitFor(() => {})

    unmount()

    expect(unsubInvestigation).toHaveBeenCalled()
    expect(unsubEntries).toHaveBeenCalled()
  })
})
