import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useEntryImages } from '../useEntryImages'

describe('useEntryImages', () => {
  beforeEach(() => {
    window.electronAPI.getEntryImage = vi.fn().mockImplementation((path: string) =>
      Promise.resolve(`data:image/png;base64,${path}`)
    )
  })

  it('returns empty object initially', () => {
    const { result } = renderHook(() => useEntryImages([]))
    expect(result.current).toEqual({})
  })

  it('loads images for given paths', async () => {
    const { result } = renderHook(() => useEntryImages(['img/a.png', 'img/b.png']))

    await waitFor(() => {
      expect(result.current['img/a.png']).toBe('data:image/png;base64,img/a.png')
      expect(result.current['img/b.png']).toBe('data:image/png;base64,img/b.png')
    })

    expect(window.electronAPI.getEntryImage).toHaveBeenCalledTimes(2)
  })

  it('does not re-fetch already loaded images', async () => {
    const { result, rerender } = renderHook(
      ({ paths }) => useEntryImages(paths),
      { initialProps: { paths: ['img/a.png'] } }
    )

    await waitFor(() => {
      expect(result.current['img/a.png']).toBeDefined()
    })

    expect(window.electronAPI.getEntryImage).toHaveBeenCalledTimes(1)

    // Re-render with the same path — should not trigger another fetch
    rerender({ paths: ['img/a.png'] })

    // Give it a tick to run effects
    await waitFor(() => {
      expect(window.electronAPI.getEntryImage).toHaveBeenCalledTimes(1)
    })
  })

  it('cancels pending loads on unmount', async () => {
    let resolveImage: (value: string) => void
    window.electronAPI.getEntryImage = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => { resolveImage = resolve })
    )

    const { result, unmount } = renderHook(() => useEntryImages(['img/slow.png']))

    unmount()

    // Resolve after unmount — should not update state (no errors)
    resolveImage!('data:image/png;base64,late')

    // State should remain empty (no update after unmount)
    expect(result.current).toEqual({})
  })

  it('handles image load failures silently', async () => {
    window.electronAPI.getEntryImage = vi.fn().mockImplementation((path: string) => {
      if (path === 'img/bad.png') return Promise.reject(new Error('not found'))
      return Promise.resolve('data:image/png;base64,ok')
    })

    const { result } = renderHook(() => useEntryImages(['img/bad.png', 'img/good.png']))

    await waitFor(() => {
      expect(result.current['img/good.png']).toBe('data:image/png;base64,ok')
    })

    // The failed image should not appear in results
    expect(result.current['img/bad.png']).toBeUndefined()
  })
})
