import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import App from '../App'
import { TitleBar } from '../components/TitleBar'
import { CURL, DOCKER } from '../../../shared/__tests__/fixtures/commands'
import { tokenise, tokenStart } from '../../../shared/tokeniser'

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
    window.electronAPI.copyToClipboard = vi.fn().mockResolvedValue(undefined)
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

  describe('copy out, close and reset', () => {
    beforeEach(() => {
      window.electronAPI.hideTokeniserOverlay = vi.fn().mockResolvedValue(undefined)
    })

    it('Enter in hats mode copies the full text then hides', async () => {
      render(<App />)
      await paste()
      fireEvent.keyDown(overlay(), { key: 'Enter' })
      await waitFor(() => expect(window.electronAPI.copyToClipboard).toHaveBeenCalledWith(CURL.trim()))
      await waitFor(() => expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled())
    })

    it('Cmd+Enter in hats mode does the same', async () => {
      render(<App />)
      await paste()
      fireEvent.keyDown(overlay(), { key: 'Enter', metaKey: true })
      await waitFor(() => expect(window.electronAPI.copyToClipboard).toHaveBeenCalledWith(CURL.trim()))
      await waitFor(() => expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled())
    })

    it('Cmd+C in hats mode copies, shows a toast and does not hide', async () => {
      render(<App />)
      await paste()
      const notCancelled = fireEvent.keyDown(overlay(), { key: 'c', metaKey: true })
      expect(notCancelled).toBe(false)
      await waitFor(() => expect(window.electronAPI.copyToClipboard).toHaveBeenCalledWith(CURL.trim()))
      await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Copied'))
      expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
    })

    it('the title bar copy buttons call the same two paths', async () => {
      render(<App />)
      await paste()
      fireEvent.click(screen.getByRole('button', { name: 'copy' }))
      await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Copied'))
      expect(window.electronAPI.copyToClipboard).toHaveBeenCalledWith(CURL.trim())
      expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'copy & close' }))
      await waitFor(() => expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled())
      expect(window.electronAPI.copyToClipboard).toHaveBeenCalledTimes(2)
    })

    it('Escape in hats mode hides without copying', async () => {
      render(<App />)
      await paste()
      fireEvent.keyDown(overlay(), { key: 'Escape' })
      expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled()
      expect(window.electronAPI.copyToClipboard).not.toHaveBeenCalled()
    })

    it('Escape in the empty state hides', () => {
      render(<App />)
      fireEvent.keyDown(overlay(), { key: 'Escape' })
      expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled()
      expect(window.electronAPI.copyToClipboard).not.toHaveBeenCalled()
    })

    it('tokeniser:shown resets to empty, even mid-edit', async () => {
      let shown: () => void = () => {}
      window.electronAPI.onTokeniserShown = vi.fn((cb: () => void) => { shown = cb; return () => {} })
      render(<App />)
      await paste()
      fireEvent.keyDown(overlay(), { key: 'a' })
      await screen.findByTestId('inline-editor')
      act(() => shown())
      expect(screen.getByText('Paste a command')).toBeInTheDocument()
      expect(screen.queryByTestId('inline-editor')).toBeNull()
    })

    it('the copy must finish before hide is requested', async () => {
      let resolveCopy: () => void = () => {}
      window.electronAPI.copyToClipboard = vi.fn(() => new Promise<void>((r) => { resolveCopy = r }))
      render(<App />)
      await paste()
      fireEvent.keyDown(overlay(), { key: 'Enter' })
      expect(window.electronAPI.copyToClipboard).toHaveBeenCalled()
      expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
      await act(async () => { resolveCopy() })
      expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled()
    })

    it('a rejected copy shows "Copy failed" and does not hide', async () => {
      window.electronAPI.copyToClipboard = vi.fn().mockRejectedValue(new Error('nope'))
      render(<App />)
      await paste()
      fireEvent.keyDown(overlay(), { key: 'Enter' })
      await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Copy failed'))
      expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
    })
  })

  describe('text mode', () => {
    async function enterTextWithTab() {
      fireEvent.keyDown(overlay(), { key: 'Tab' })
      return (await screen.findByTestId('text-editor')) as HTMLTextAreaElement
    }

    it('Tab enters text mode with the full text and the text status strip; Tab again rescans back', async () => {
      render(<App />)
      await paste()
      const ta = await enterTextWithTab()
      expect(ta.value).toBe(CURL.trim())
      expect(screen.getByTestId('status-strip')).toHaveTextContent('edit freely')
      expect(document.activeElement).toBe(ta)
      fireEvent.change(ta, { target: { value: 'a b c' } })
      fireEvent.keyDown(ta, { key: 'Tab' })
      await waitFor(() => expect(screen.getAllByTestId('hat')).toHaveLength(3))
      expect(screen.queryByTestId('text-editor')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(overlay())
    })

    it('Escape in text mode returns to hats, not close', async () => {
      render(<App />)
      await paste()
      const ta = await enterTextWithTab()
      fireEvent.keyDown(ta, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByTestId('text-editor')).not.toBeInTheDocument())
      expect(screen.getByTestId('mode-pill')).toHaveTextContent('hats')
      expect(commandText()).toBe(CURL)
      expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
    })

    it('Cmd+A in hats mode enters text mode with everything selected', async () => {
      render(<App />)
      await paste()
      fireEvent.keyDown(overlay(), { key: 'a', metaKey: true })
      const ta = (await screen.findByTestId('text-editor')) as HTMLTextAreaElement
      expect(ta.selectionStart).toBe(0)
      expect(ta.selectionEnd).toBe(ta.value.length)
      expect(ta.value.length).toBeGreaterThan(0)
    })

    it('a single click on the command enters text mode with the caret at that token', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        render(<App />)
        await paste()
        const tokens = tokenise(CURL)
        const post = tokens.findIndex((t) => t.text === 'POST')
        const expected = tokenStart(tokens, post)
        expect(expected).toBe(8)
        const target = screen.getAllByTestId('token')[1]
        expect(target.lastChild?.textContent).toBe('POST')
        fireEvent.click(target)
        act(() => { vi.advanceTimersByTime(250) })
        const ta = screen.getByTestId('text-editor') as HTMLTextAreaElement
        expect(ta.selectionStart).toBe(expected)
        expect(ta.selectionEnd).toBe(expected)
        expect(document.activeElement).toBe(ta)
      } finally {
        vi.useRealTimers()
      }
    })

    it('clicking the mode pill toggles modes', async () => {
      render(<App />)
      await paste()
      fireEvent.click(screen.getByTestId('mode-pill'))
      const ta = (await screen.findByTestId('text-editor')) as HTMLTextAreaElement
      expect(screen.getByTestId('mode-pill')).toHaveTextContent('text')
      fireEvent.change(ta, { target: { value: 'x y' } })
      fireEvent.click(screen.getByTestId('mode-pill'))
      await waitFor(() => expect(screen.queryByTestId('text-editor')).not.toBeInTheDocument())
      expect(screen.getByTestId('mode-pill')).toHaveTextContent('hats')
      expect(screen.getAllByTestId('hat')).toHaveLength(2)
    })

    it('leaving text mode with empty text returns to the empty state', async () => {
      render(<App />)
      await paste()
      const ta = await enterTextWithTab()
      fireEvent.change(ta, { target: { value: '   \n ' } })
      fireEvent.keyDown(ta, { key: 'Tab' })
      expect(await screen.findByText('Paste a command')).toBeInTheDocument()
      expect(screen.queryByTestId('mode-pill')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(overlay())
    })

    it('Cmd+C in text mode with no selection copies the whole text and stays open', async () => {
      render(<App />)
      await paste()
      const ta = await enterTextWithTab()
      ta.setSelectionRange(3, 3)
      const notCancelled = fireEvent.keyDown(ta, { key: 'c', metaKey: true })
      expect(notCancelled).toBe(false)
      expect(window.electronAPI.copyToClipboard).toHaveBeenCalledWith(ta.value)
      await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Copied'))
      expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
      expect(screen.getByTestId('text-editor')).toBeInTheDocument()
    })

    it('Cmd+C in text mode with a selection is left to the native copy', async () => {
      render(<App />)
      await paste()
      const ta = await enterTextWithTab()
      ta.setSelectionRange(0, 4)
      const notCancelled = fireEvent.keyDown(ta, { key: 'c', metaKey: true })
      expect(notCancelled).toBe(true)
      expect(window.electronAPI.copyToClipboard).not.toHaveBeenCalled()
    })

    it('Cmd+Enter in text mode copies and hides', async () => {
      render(<App />)
      await paste()
      const ta = await enterTextWithTab()
      fireEvent.change(ta, { target: { value: 'echo hi' } })
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
      expect(window.electronAPI.copyToClipboard).toHaveBeenCalledWith('echo hi')
      await waitFor(() => expect(window.electronAPI.hideTokeniserOverlay).toHaveBeenCalled())
    })

    it('text mode shares the hats view font and colour classes', async () => {
      render(<App />)
      await paste()
      const ta = await enterTextWithTab()
      expect(ta.className).toMatch(/\bcmd\b/)
      expect(screen.getByTestId('overlay').className).toMatch(/font-mono/)
    })

    it('Escape with focus on the overlay while in text mode leaves text mode instead of hiding', async () => {
      render(<App />)
      await paste()
      await enterTextWithTab()
      fireEvent.keyDown(overlay(), { key: 'Escape' })
      expect(await screen.findAllByTestId('hat')).toHaveLength(24)
      expect(screen.queryByTestId('text-editor')).not.toBeInTheDocument()
      expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
    })

    it('plain Enter in text mode is not intercepted', async () => {
      render(<App />)
      await paste()
      const ta = await enterTextWithTab()
      const notCancelled = fireEvent.keyDown(ta, { key: 'Enter' })
      expect(notCancelled).toBe(true)
      expect(window.electronAPI.copyToClipboard).not.toHaveBeenCalled()
      expect(window.electronAPI.hideTokeniserOverlay).not.toHaveBeenCalled()
      expect(screen.getByTestId('text-editor')).toBeInTheDocument()
    })
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
