import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useBoardAutoSave } from '../useBoardAutoSave'
import type { BoardNode, BoardEdge, BoardViewport } from '@shared/board-types'

const mockNodes: BoardNode[] = [
  {
    id: 'n1',
    board_id: 'board-1',
    node_type: 'textbox',
    position_x: 0,
    position_y: 0,
    width: 100,
    height: 50,
    z_index: 0,
    data_json: '{"text":"hi"}',
    created_at: ''
  }
]

const mockEdges: BoardEdge[] = []
const mockViewport: BoardViewport = { x: 0, y: 0, zoom: 1 }

describe('useBoardAutoSave', () => {
  let setDirty: ReturnType<typeof vi.fn>
  let toBoardNodes: ReturnType<typeof vi.fn>
  let toBoardEdges: ReturnType<typeof vi.fn>
  let toBoardViewport: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    setDirty = vi.fn()
    toBoardNodes = vi.fn().mockReturnValue(mockNodes)
    toBoardEdges = vi.fn().mockReturnValue(mockEdges)
    toBoardViewport = vi.fn().mockReturnValue(mockViewport)
    window.electronAPI.saveBoardState = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves after 1 second debounce when dirty', () => {
    renderHook(() =>
      useBoardAutoSave({
        boardId: 'board-1',
        isDirty: true,
        setDirty,
        toBoardNodes,
        toBoardEdges,
        toBoardViewport
      })
    )

    expect(window.electronAPI.saveBoardState).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)

    expect(window.electronAPI.saveBoardState).toHaveBeenCalledWith('board-1', {
      nodes: mockNodes,
      edges: mockEdges,
      viewport: mockViewport
    })
    expect(setDirty).toHaveBeenCalledWith(false)
  })

  it('does not save when not dirty', () => {
    renderHook(() =>
      useBoardAutoSave({
        boardId: 'board-1',
        isDirty: false,
        setDirty,
        toBoardNodes,
        toBoardEdges,
        toBoardViewport
      })
    )

    vi.advanceTimersByTime(2000)

    expect(window.electronAPI.saveBoardState).not.toHaveBeenCalled()
  })

  it('does not save when boardId is null', () => {
    renderHook(() =>
      useBoardAutoSave({
        boardId: null,
        isDirty: true,
        setDirty,
        toBoardNodes,
        toBoardEdges,
        toBoardViewport
      })
    )

    vi.advanceTimersByTime(2000)

    expect(window.electronAPI.saveBoardState).not.toHaveBeenCalled()
  })

  it('flushes pending save when boardId changes', () => {
    const { rerender } = renderHook(
      ({ boardId, isDirty }: { boardId: string | null; isDirty: boolean }) =>
        useBoardAutoSave({
          boardId,
          isDirty,
          setDirty,
          toBoardNodes,
          toBoardEdges,
          toBoardViewport
        }),
      { initialProps: { boardId: 'board-1', isDirty: true } }
    )

    // Board changes before debounce fires — should flush immediately.
    // Note: boardIdRef.current is updated to the new ID before the effect runs,
    // so save uses the new boardId. isDirty must remain true for the flush to fire.
    rerender({ boardId: 'board-2', isDirty: true })

    expect(window.electronAPI.saveBoardState).toHaveBeenCalledTimes(1)
    expect(setDirty).toHaveBeenCalledWith(false)
  })

  it('saves on unmount if dirty', () => {
    const { unmount } = renderHook(() =>
      useBoardAutoSave({
        boardId: 'board-1',
        isDirty: true,
        setDirty,
        toBoardNodes,
        toBoardEdges,
        toBoardViewport
      })
    )

    unmount()

    expect(window.electronAPI.saveBoardState).toHaveBeenCalledWith('board-1', {
      nodes: mockNodes,
      edges: mockEdges,
      viewport: mockViewport
    })
  })

  it('does not save on unmount if not dirty', () => {
    const { unmount } = renderHook(() =>
      useBoardAutoSave({
        boardId: 'board-1',
        isDirty: false,
        setDirty,
        toBoardNodes,
        toBoardEdges,
        toBoardViewport
      })
    )

    unmount()

    expect(window.electronAPI.saveBoardState).not.toHaveBeenCalled()
  })

  it('resets debounce timer when isDirty changes rapidly', () => {
    const { rerender } = renderHook(
      ({ isDirty }: { isDirty: boolean }) =>
        useBoardAutoSave({
          boardId: 'board-1',
          isDirty,
          setDirty,
          toBoardNodes,
          toBoardEdges,
          toBoardViewport
        }),
      { initialProps: { isDirty: true } }
    )

    // Advance partway through debounce
    vi.advanceTimersByTime(500)
    expect(window.electronAPI.saveBoardState).not.toHaveBeenCalled()

    // Toggle dirty off and on — should reset timer
    rerender({ isDirty: false })
    rerender({ isDirty: true })

    vi.advanceTimersByTime(500)
    expect(window.electronAPI.saveBoardState).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(window.electronAPI.saveBoardState).toHaveBeenCalledTimes(1)
  })
})
