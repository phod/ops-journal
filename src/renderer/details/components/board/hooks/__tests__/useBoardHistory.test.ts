import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useBoardHistory } from '../useBoardHistory'
import type { Node, Edge } from '@xyflow/react'

function makeNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'textbox',
    position: { x: i * 100, y: 0 },
    data: { text: `node ${i}` }
  }))
}

function makeEdges(count: number): Edge[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `edge-${i}`,
    source: `node-${i}`,
    target: `node-${i + 1}`
  }))
}

describe('useBoardHistory', () => {
  it('starts with empty history', () => {
    let nodes = makeNodes(1)
    let edges = makeEdges(0)

    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => nodes, () => edges)
    )

    expect(result.current.canUndo()).toBe(false)
    expect(result.current.canRedo()).toBe(false)
  })

  it('pushSnapshot enables undo', () => {
    let nodes = makeNodes(1)
    let edges = makeEdges(0)

    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => nodes, () => edges)
    )

    act(() => {
      result.current.pushSnapshot()
    })

    expect(result.current.canUndo()).toBe(true)
    expect(result.current.canRedo()).toBe(false)
  })

  it('undo returns previous snapshot and enables redo', () => {
    const initialNodes = makeNodes(1)
    const initialEdges = makeEdges(0)
    let currentNodes = initialNodes
    let currentEdges = initialEdges

    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => currentNodes, () => currentEdges)
    )

    // Push snapshot of initial state, then change state
    act(() => {
      result.current.pushSnapshot()
    })

    const newNodes = makeNodes(2)
    currentNodes = newNodes

    // Undo should return the initial state
    let snapshot: ReturnType<typeof result.current.undo>
    act(() => {
      snapshot = result.current.undo()
    })

    expect(snapshot!).not.toBeNull()
    expect(snapshot!.nodes).toEqual(initialNodes)
    expect(snapshot!.edges).toEqual(initialEdges)
    expect(result.current.canUndo()).toBe(false)
    expect(result.current.canRedo()).toBe(true)
  })

  it('redo returns the state that was undone', () => {
    const initialNodes = makeNodes(1)
    let currentNodes = initialNodes
    let currentEdges: Edge[] = []

    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => currentNodes, () => currentEdges)
    )

    act(() => {
      result.current.pushSnapshot()
    })

    const afterNodes = makeNodes(3)
    currentNodes = afterNodes

    // Undo
    act(() => {
      const snapshot = result.current.undo()
      if (snapshot) currentNodes = snapshot.nodes
    })

    // Redo should return the "after" state
    let snapshot: ReturnType<typeof result.current.redo>
    act(() => {
      snapshot = result.current.redo()
    })

    expect(snapshot!).not.toBeNull()
    expect(snapshot!.nodes).toEqual(afterNodes)
    expect(result.current.canUndo()).toBe(true)
    expect(result.current.canRedo()).toBe(false)
  })

  it('undo returns null when nothing to undo', () => {
    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => [], () => [])
    )

    let snapshot: ReturnType<typeof result.current.undo>
    act(() => {
      snapshot = result.current.undo()
    })

    expect(snapshot!).toBeNull()
  })

  it('redo returns null when nothing to redo', () => {
    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => [], () => [])
    )

    let snapshot: ReturnType<typeof result.current.redo>
    act(() => {
      snapshot = result.current.redo()
    })

    expect(snapshot!).toBeNull()
  })

  it('new action after undo clears future stack', () => {
    let currentNodes = makeNodes(1)
    let currentEdges: Edge[] = []

    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => currentNodes, () => currentEdges)
    )

    // Push two snapshots
    act(() => {
      result.current.pushSnapshot()
    })
    currentNodes = makeNodes(2)
    act(() => {
      result.current.pushSnapshot()
    })
    currentNodes = makeNodes(3)

    // Undo once
    act(() => {
      const snapshot = result.current.undo()
      if (snapshot) currentNodes = snapshot.nodes
    })

    expect(result.current.canRedo()).toBe(true)

    // Push a new snapshot — should clear future
    act(() => {
      result.current.pushSnapshot()
    })

    expect(result.current.canRedo()).toBe(false)
  })

  it('resets stacks when boardId changes', () => {
    let currentNodes = makeNodes(1)
    let currentEdges: Edge[] = []
    let boardId = 'board-1'

    const { result, rerender } = renderHook(
      ({ boardId: bid }) => useBoardHistory(bid, () => currentNodes, () => currentEdges),
      { initialProps: { boardId: 'board-1' } }
    )

    act(() => {
      result.current.pushSnapshot()
    })
    expect(result.current.canUndo()).toBe(true)

    // Change board
    rerender({ boardId: 'board-2' })

    expect(result.current.canUndo()).toBe(false)
    expect(result.current.canRedo()).toBe(false)
  })

  it('caps history at 50 entries', () => {
    let currentNodes = makeNodes(1)
    let currentEdges: Edge[] = []

    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => currentNodes, () => currentEdges)
    )

    // Push 55 snapshots
    for (let i = 0; i < 55; i++) {
      act(() => {
        result.current.pushSnapshot()
      })
      currentNodes = makeNodes(i + 2)
    }

    // Should be capped at 50
    let undoCount = 0
    while (result.current.canUndo()) {
      act(() => {
        result.current.undo()
      })
      undoCount++
    }

    expect(undoCount).toBe(50)
  })

  it('supports multiple undo/redo cycles', () => {
    let currentNodes = makeNodes(1)
    let currentEdges: Edge[] = []

    const { result } = renderHook(() =>
      useBoardHistory('board-1', () => currentNodes, () => currentEdges)
    )

    const states: Node[][] = [currentNodes]

    // Push 3 states
    for (let i = 1; i <= 3; i++) {
      act(() => {
        result.current.pushSnapshot()
      })
      currentNodes = makeNodes(i + 1)
      states.push(currentNodes)
    }

    // Undo all 3
    for (let i = 2; i >= 0; i--) {
      let snapshot: ReturnType<typeof result.current.undo>
      act(() => {
        snapshot = result.current.undo()
      })
      expect(snapshot!.nodes).toEqual(states[i])
      currentNodes = snapshot!.nodes
    }

    // Redo all 3
    for (let i = 1; i <= 3; i++) {
      let snapshot: ReturnType<typeof result.current.redo>
      act(() => {
        snapshot = result.current.redo()
      })
      expect(snapshot!.nodes).toEqual(states[i])
      currentNodes = snapshot!.nodes
    }
  })
})
