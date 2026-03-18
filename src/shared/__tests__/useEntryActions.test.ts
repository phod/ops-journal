import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useEntryActions } from '../useEntryActions'
import type { JournalEntry } from '@shared/ipc-types'

const baseEntry: JournalEntry = {
  id: 'entry-1',
  investigation_id: 'inv-1',
  body: 'Test entry',
  image_paths: [],
  created_at: '2024-01-01 10:00:00',
  type: 'note'
}

describe('useEntryActions', () => {
  let onUpdated: ReturnType<typeof vi.fn>
  let setShowTypeMenu: ReturnType<typeof vi.fn>
  let setShowStatusMenu: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onUpdated = vi.fn()
    setShowTypeMenu = vi.fn()
    setShowStatusMenu = vi.fn()
  })

  describe('changeType', () => {
    it('calls updateEntry and onUpdated with the result', async () => {
      const updated = { ...baseEntry, type: 'action' as const }
      window.electronAPI.updateEntry = vi.fn().mockResolvedValue(updated)

      const { result } = renderHook(() =>
        useEntryActions({ entry: baseEntry, onUpdated, setShowTypeMenu })
      )

      await act(() => result.current.changeType('action'))

      expect(setShowTypeMenu).toHaveBeenCalledWith(false)
      expect(window.electronAPI.updateEntry).toHaveBeenCalledWith(
        'entry-1', 'Test entry', undefined, 'action'
      )
      expect(onUpdated).toHaveBeenCalledWith(updated)
    })

    it('skips API call when type is unchanged', async () => {
      window.electronAPI.updateEntry = vi.fn()

      const { result } = renderHook(() =>
        useEntryActions({ entry: baseEntry, onUpdated, setShowTypeMenu })
      )

      await act(() => result.current.changeType('note'))

      expect(setShowTypeMenu).toHaveBeenCalledWith(false)
      expect(window.electronAPI.updateEntry).not.toHaveBeenCalled()
      expect(onUpdated).not.toHaveBeenCalled()
    })

    it('handles API errors without throwing', async () => {
      window.electronAPI.updateEntry = vi.fn().mockRejectedValue(new Error('fail'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() =>
        useEntryActions({ entry: baseEntry, onUpdated })
      )

      await act(() => result.current.changeType('finding'))

      expect(onUpdated).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('works without setShowTypeMenu', async () => {
      const updated = { ...baseEntry, type: 'finding' as const }
      window.electronAPI.updateEntry = vi.fn().mockResolvedValue(updated)

      const { result } = renderHook(() =>
        useEntryActions({ entry: baseEntry, onUpdated })
      )

      await act(() => result.current.changeType('finding'))
      expect(onUpdated).toHaveBeenCalledWith(updated)
    })
  })

  describe('changeHypothesisStatus', () => {
    const hypothesisEntry: JournalEntry = {
      ...baseEntry,
      type: 'hypothesis',
      hypothesis_status: 'open'
    }

    it('calls updateHypothesisStatus and onUpdated', async () => {
      const updated = { ...hypothesisEntry, hypothesis_status: 'true' as const }
      window.electronAPI.updateHypothesisStatus = vi.fn().mockResolvedValue(updated)

      const { result } = renderHook(() =>
        useEntryActions({ entry: hypothesisEntry, onUpdated, setShowStatusMenu })
      )

      await act(() => result.current.changeHypothesisStatus('true'))

      expect(setShowStatusMenu).toHaveBeenCalledWith(false)
      expect(window.electronAPI.updateHypothesisStatus).toHaveBeenCalledWith('entry-1', 'true')
      expect(onUpdated).toHaveBeenCalledWith(updated)
    })

    it('handles API errors without throwing', async () => {
      window.electronAPI.updateHypothesisStatus = vi.fn().mockRejectedValue(new Error('fail'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() =>
        useEntryActions({ entry: hypothesisEntry, onUpdated, setShowStatusMenu })
      )

      await act(() => result.current.changeHypothesisStatus('false'))

      expect(onUpdated).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('toggleCompleted', () => {
    it('calls toggleActionCompleted and onUpdated', async () => {
      const actionEntry: JournalEntry = { ...baseEntry, type: 'action', action_completed: false }
      const updated = { ...actionEntry, action_completed: true }
      window.electronAPI.toggleActionCompleted = vi.fn().mockResolvedValue(updated)

      const { result } = renderHook(() =>
        useEntryActions({ entry: actionEntry, onUpdated })
      )

      await act(() => result.current.toggleCompleted())

      expect(window.electronAPI.toggleActionCompleted).toHaveBeenCalledWith('entry-1')
      expect(onUpdated).toHaveBeenCalledWith(updated)
    })

    it('handles API errors without throwing', async () => {
      window.electronAPI.toggleActionCompleted = vi.fn().mockRejectedValue(new Error('fail'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() =>
        useEntryActions({ entry: baseEntry, onUpdated })
      )

      await act(() => result.current.toggleCompleted())

      expect(onUpdated).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('toggleFlagged', () => {
    it('calls toggleFlagged and onUpdated', async () => {
      const updated = { ...baseEntry, flagged: true }
      window.electronAPI.toggleFlagged = vi.fn().mockResolvedValue(updated)

      const { result } = renderHook(() =>
        useEntryActions({ entry: baseEntry, onUpdated })
      )

      await act(() => result.current.toggleFlagged())

      expect(window.electronAPI.toggleFlagged).toHaveBeenCalledWith('entry-1')
      expect(onUpdated).toHaveBeenCalledWith(updated)
    })

    it('handles API errors without throwing', async () => {
      window.electronAPI.toggleFlagged = vi.fn().mockRejectedValue(new Error('fail'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() =>
        useEntryActions({ entry: baseEntry, onUpdated })
      )

      await act(() => result.current.toggleFlagged())

      expect(onUpdated).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
