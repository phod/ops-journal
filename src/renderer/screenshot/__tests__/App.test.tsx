import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { App } from '../App'

describe('Screenshot App', () => {
  beforeEach(() => {
    window.electronAPI.onScreenshotData = vi.fn().mockReturnValue(() => {})
    window.electronAPI.sendScreenshotSelection = vi.fn()
  })

  it('renders the instruction hint when not dragging', () => {
    render(<App />)
    expect(screen.getByText(/drag to select region/i)).toBeInTheDocument()
  })

  it('registers a screenshot:data listener on mount', () => {
    render(<App />)
    expect(window.electronAPI.onScreenshotData).toHaveBeenCalled()
  })

  it('cleans up the screenshot:data listener on unmount', () => {
    const cleanup = vi.fn()
    window.electronAPI.onScreenshotData = vi.fn().mockReturnValue(cleanup)

    const { unmount } = render(<App />)
    unmount()

    expect(cleanup).toHaveBeenCalled()
  })

  it('sends null selection on Escape', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(window.electronAPI.sendScreenshotSelection).toHaveBeenCalledWith(null)
  })

  it('hides the instruction hint while dragging', () => {
    render(<App />)

    const container = document.querySelector('[style*="crosshair"]') as HTMLElement
    fireEvent.mouseDown(container, { clientX: 10, clientY: 20 })

    expect(screen.queryByText(/drag to select region/i)).not.toBeInTheDocument()
  })

  it('shows the selection rectangle while dragging', () => {
    render(<App />)

    const container = document.querySelector('[style*="crosshair"]') as HTMLElement
    fireEvent.mouseDown(container, { clientX: 50, clientY: 60 })
    fireEvent.mouseMove(container, { clientX: 150, clientY: 160 })

    // The selection div is rendered (box-shadow used as cut-out overlay)
    const selectionDiv = document.querySelector('[style*="box-shadow"]')
    expect(selectionDiv).toBeInTheDocument()
  })

  it('sends selection rect on mouseUp after valid drag', () => {
    render(<App />)

    const container = document.querySelector('[style*="crosshair"]') as HTMLElement
    fireEvent.mouseDown(container, { clientX: 10, clientY: 20 })
    fireEvent.mouseMove(container, { clientX: 110, clientY: 120 })
    fireEvent.mouseUp(container, { clientX: 110, clientY: 120 })

    expect(window.electronAPI.sendScreenshotSelection).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 100,
      height: 100
    })
  })

  it('sends null selection when drag is too small (< 4px)', () => {
    render(<App />)

    const container = document.querySelector('[style*="crosshair"]') as HTMLElement
    fireEvent.mouseDown(container, { clientX: 10, clientY: 20 })
    fireEvent.mouseMove(container, { clientX: 12, clientY: 22 })
    fireEvent.mouseUp(container, { clientX: 12, clientY: 22 })

    expect(window.electronAPI.sendScreenshotSelection).toHaveBeenCalledWith(null)
  })

  it('normalises rect when dragged from bottom-right to top-left', () => {
    render(<App />)

    const container = document.querySelector('[style*="crosshair"]') as HTMLElement
    fireEvent.mouseDown(container, { clientX: 200, clientY: 200 })
    fireEvent.mouseMove(container, { clientX: 50, clientY: 50 })
    fireEvent.mouseUp(container, { clientX: 50, clientY: 50 })

    expect(window.electronAPI.sendScreenshotSelection).toHaveBeenCalledWith({
      x: 50,
      y: 50,
      width: 150,
      height: 150
    })
  })

  it('renders a background image when screenshot data arrives', () => {
    const dataUrl = 'data:image/png;base64,fakescreen'
    let capturedCallback: ((url: string) => void) | null = null

    window.electronAPI.onScreenshotData = vi.fn().mockImplementation((cb) => {
      capturedCallback = cb
      return () => {}
    })

    render(<App />)

    // Simulate screenshot data being sent from main
    act(() => {
      capturedCallback!(dataUrl)
    })

    const bgImg = document.querySelector('img[draggable="false"]') as HTMLImageElement
    expect(bgImg).toBeInTheDocument()
    expect(bgImg.src).toBe(dataUrl)
  })

  it('does not send a selection if mouseUp fires without a prior mouseDown', () => {
    render(<App />)

    const container = document.querySelector('[style*="crosshair"]') as HTMLElement
    fireEvent.mouseUp(container, { clientX: 100, clientY: 100 })

    expect(window.electronAPI.sendScreenshotSelection).not.toHaveBeenCalled()
  })
})
