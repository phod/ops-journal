import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import App from '../App'
import { TitleBar } from '../components/TitleBar'
import { CURL, DOCKER } from '../../../shared/__tests__/fixtures/commands'

const TENANT = '8f1c2d3e-4b5a-4c6d-9e7f-0a1b2c3d4e5f'

function overlay() {
  return screen.getByTestId('overlay')
}

async function paste() {
  fireEvent.keyDown(overlay(), { key: 'v', metaKey: true })
  await screen.findAllByTestId('token')
}

/** The rendered command with hat labels stripped out. */
function commandText(): string {
  const cmd = overlay().querySelector('.cmd')
  if (!cmd) return ''
  const clone = cmd.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.hat').forEach((h) => h.remove())
  return clone.textContent ?? ''
}

async function openHat(key: string) {
  fireEvent.keyDown(overlay(), { key })
  return screen.findByTestId('inline-editor')
}

describe('Tokeniser App', () => {
  beforeEach(() => {
    window.electronAPI.readClipboard = vi.fn().mockResolvedValue(CURL)
    window.electronAPI.getOpaqueOverlay = vi.fn().mockResolvedValue(false)
    window.electronAPI.hideTokeniserOverlay = vi.fn()
  })

  it('starts empty with the paste hint and the empty status strip', async () => {
    render(<App />)
    expect(screen.getByText('Paste a command')).toBeInTheDocument()
    expect(screen.getByTestId('status-strip')).toHaveTextContent('⌘V paste')
    expect(screen.queryByTestId('mode-pill')).not.toBeInTheDocument()
    await waitFor(() => expect(window.electronAPI.getOpaqueOverlay).toHaveBeenCalled())
  })

  it('focuses the overlay on mount', () => {
    render(<App />)
    expect(document.activeElement).toBe(overlay())
  })

  it('Cmd+V reads the clipboard and renders hats', async () => {
    render(<App />)
    await paste()
    expect(window.electronAPI.readClipboard).toHaveBeenCalled()
    expect(screen.getAllByTestId('hat')[0]).toHaveTextContent('a')
    expect(commandText()).toBe(CURL)
    expect(screen.getByTestId('mode-pill')).toHaveTextContent('hats')
    expect(screen.getByText('24 targets', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByTestId('toast')).toHaveTextContent('24 targets')
  })

  it('typing a hat opens the editor with the token text selected and the hat letter not inserted', async () => {
    render(<App />)
    await paste()
    const ed = await openHat('g')
    expect(ed).toHaveTextContent(TENANT)
    expect(ed.textContent).toBe(TENANT)
    expect(ed.textContent).not.toBe('g')
    expect(document.activeElement).toBe(ed)
    expect(screen.getByTestId('status-strip')).toHaveTextContent('editing token')
  })

  it('the hat keydown is default-prevented so the letter never reaches the editor', async () => {
    render(<App />)
    await paste()
    const notCancelled = fireEvent.keyDown(overlay(), { key: 'g' })
    expect(notCancelled).toBe(false)
  })

  it('Enter commits and rescans so added words get hats', async () => {
    render(<App />)
    await paste()
    const before = screen.getAllByTestId('hat').length
    const ed = await openHat('b')
    expect(ed.textContent).toBe('POST')
    ed.textContent = 'POST --retry 3'
    fireEvent.keyDown(ed, { key: 'Enter' })
    await waitFor(() => expect(screen.queryByTestId('inline-editor')).not.toBeInTheDocument())
    expect(screen.getAllByTestId('hat')).toHaveLength(before + 1)
    expect(commandText()).toContain("-X POST --retry 3 'https")
    expect(screen.getByTestId('status-strip')).toHaveTextContent('type a letter to edit that token')
    const edited = screen.getAllByTestId('token').filter((t) => t.className.includes('edited'))
    expect(edited.length).toBeGreaterThan(0)
    expect(document.activeElement).toBe(overlay())
  })

  it('emptying a token removes its hat and collapses the space', async () => {
    // Whitespace collapses only between plain spaces, so use a command with space-separated words
    window.electronAPI.readClipboard = vi.fn().mockResolvedValue('kubectl get pods -n prod')
    render(<App />)
    await paste()
    const before = screen.getAllByTestId('hat').length
    const get = screen.getAllByTestId('token').find((t) => t.lastChild?.textContent === 'get')!
    const ed = await openHat(get.getAttribute('data-hat')!)
    expect(ed.textContent).toBe('get')
    ed.textContent = ''
    fireEvent.keyDown(ed, { key: 'Enter' })
    await waitFor(() => expect(screen.queryByTestId('inline-editor')).not.toBeInTheDocument())
    expect(screen.getAllByTestId('hat')).toHaveLength(before - 1)
    expect(commandText()).toBe('kubectl pods -n prod')
  })

  it('Escape cancels an edit and leaves the text unchanged', async () => {
    render(<App />)
    await paste()
    const ed = await openHat('b')
    ed.textContent = 'PUT'
    fireEvent.keyDown(ed, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('inline-editor')).not.toBeInTheDocument())
    expect(commandText()).toBe(CURL)
    expect(screen.getByTestId('status-strip')).toHaveTextContent('type a letter to edit that token')
  })

  it('first letter of a two-letter hat dims non-matching hats', async () => {
    window.electronAPI.readClipboard = vi.fn().mockResolvedValue(DOCKER)
    render(<App />)
    await paste()
    fireEvent.keyDown(overlay(), { key: 'z' })
    await waitFor(() => expect(screen.getByTestId('status-strip')).toHaveTextContent('second letter'))
    const hats = screen.getAllByTestId('hat')
    const zHats = hats.filter((h) => (h.textContent ?? '').startsWith('z'))
    const others = hats.filter((h) => !(h.textContent ?? '').startsWith('z'))
    expect(zHats.length).toBeGreaterThan(0)
    zHats.forEach((h) => expect(h.className).toMatch(/\bpart\b/))
    others.forEach((h) => expect(h.className).toMatch(/\bmiss\b/))
    expect(zHats[0].querySelector('.h1')).toHaveTextContent('z')
    expect(zHats[0].querySelector('.h2')).not.toBeNull()

    fireEvent.keyDown(overlay(), { key: 'Escape' })
    await waitFor(() => expect(screen.getByTestId('status-strip')).not.toHaveTextContent('second letter'))
    expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
  })

  it('double-click on a token opens its editor', async () => {
    render(<App />)
    await paste()
    const target = screen.getAllByTestId('token').find((t) => t.getAttribute('data-hat') === 'g')!
    fireEvent.doubleClick(target)
    const ed = await screen.findByTestId('inline-editor')
    expect(ed.textContent).toBe(TENANT)
  })

  it('Cmd+V while editing does not replace the command', async () => {
    render(<App />)
    await paste()
    const ed = await openHat('g')
    expect(window.electronAPI.readClipboard).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(ed, { key: 'v', metaKey: true })
    expect(window.electronAPI.readClipboard).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('inline-editor')).toBeInTheDocument()
  })

  it('status strip shows the hats-mode keys', async () => {
    render(<App />)
    await paste()
    expect(screen.getByTestId('status-strip')).toHaveTextContent('type a letter to edit that token')
  })

  it('Escape with no pending hat hides the overlay', async () => {
    render(<App />)
    await paste()
    fireEvent.keyDown(overlay(), { key: 'Escape' })
    expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled()
  })

  it('the toast clears itself after about 2200ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<App />)
      await paste()
      expect(screen.getByTestId('toast')).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(2000) })
      expect(screen.getByTestId('toast')).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(300) })
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('respects the opaque overlay setting', async () => {
    window.electronAPI.getOpaqueOverlay = vi.fn().mockResolvedValue(true)
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('overlay').className).toMatch(/bg-gray-900\/95/))
  })
})

describe('TitleBar', () => {
  const noop = () => {}

  it('shows "N of M hatted" when some targets have no hat', () => {
    render(<TitleBar mode="hats" targetCount={230} hattedCount={201} onToggleMode={noop} onCopy={noop} onCopyClose={noop} />)
    expect(screen.getByText('201 of 230 hatted')).toBeInTheDocument()
  })

  it('shows a blue text pill in text mode and wires the buttons', () => {
    const onToggleMode = vi.fn()
    const onCopy = vi.fn()
    const onCopyClose = vi.fn()
    render(<TitleBar mode="text" targetCount={3} hattedCount={3} onToggleMode={onToggleMode} onCopy={onCopy} onCopyClose={onCopyClose} />)
    const pill = screen.getByTestId('mode-pill')
    expect(pill).toHaveTextContent('text')
    expect(pill.className).toMatch(/text-blue-300/)
    fireEvent.click(pill)
    fireEvent.click(screen.getByText('copy'))
    fireEvent.click(screen.getByText('copy & close'))
    expect(onToggleMode).toHaveBeenCalled()
    expect(onCopy).toHaveBeenCalled()
    expect(onCopyClose).toHaveBeenCalled()
  })
})
