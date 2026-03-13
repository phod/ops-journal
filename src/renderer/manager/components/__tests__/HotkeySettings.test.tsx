import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { HotkeySettings } from '../HotkeySettings'

describe('HotkeySettings', () => {
  beforeEach(() => {
    window.electronAPI.getHotkey = vi.fn().mockResolvedValue('CommandOrControl+Shift+J')
    window.electronAPI.setHotkey = vi.fn().mockResolvedValue(true)
    window.electronAPI.getScreenshotHotkey = vi.fn().mockResolvedValue('CommandOrControl+Shift+S')
    window.electronAPI.setScreenshotHotkey = vi.fn().mockResolvedValue(true)
    window.electronAPI.getUploadHotkey = vi.fn().mockResolvedValue('CommandOrControl+Shift+U')
    window.electronAPI.setUploadHotkey = vi.fn().mockResolvedValue(true)
  })

  it('loads and displays all three hotkeys', async () => {
    render(<HotkeySettings />)
    await waitFor(() => {
      expect(window.electronAPI.getHotkey).toHaveBeenCalled()
      expect(window.electronAPI.getScreenshotHotkey).toHaveBeenCalled()
      expect(window.electronAPI.getUploadHotkey).toHaveBeenCalled()
    })
    // Each shortcut key character should appear — use getAllBy since keys repeat across rows
    expect(screen.getAllByText('⌘').length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText('⇧').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('J')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
    expect(screen.getByText('U')).toBeInTheDocument()
  })

  it('renders all three hotkey section labels', async () => {
    render(<HotkeySettings />)
    expect(await screen.findByText('Open Journal')).toBeInTheDocument()
    expect(screen.getByText('Capture Screenshot')).toBeInTheDocument()
    expect(screen.getByText('Upload Image')).toBeInTheDocument()
  })

  it('shows a "Change shortcut" button for each row', async () => {
    render(<HotkeySettings />)
    await waitFor(() => expect(window.electronAPI.getHotkey).toHaveBeenCalled())
    const buttons = await screen.findAllByText(/change shortcut/i)
    expect(buttons).toHaveLength(3)
  })

  it('enters capture mode when "Change shortcut" is clicked on the first row', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    const buttons = await screen.findAllByText(/change shortcut/i)
    await user.click(buttons[0])
    expect(screen.getByText(/press your shortcut/i)).toBeInTheDocument()
  })

  it('shows Save and Cancel buttons in capture mode', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    const buttons = await screen.findAllByText(/change shortcut/i)
    await user.click(buttons[0])
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('exits capture mode on Cancel without saving', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    const buttons = await screen.findAllByText(/change shortcut/i)
    await user.click(buttons[0])
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByText(/press your shortcut/i)).not.toBeInTheDocument()
    expect(window.electronAPI.setHotkey).not.toHaveBeenCalled()
  })

  it('Save button is disabled until a shortcut is captured', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    const buttons = await screen.findAllByText(/change shortcut/i)
    await user.click(buttons[0])
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('calls setHotkey and exits capture mode on Save for the first row', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    const buttons = await screen.findAllByText(/change shortcut/i)
    await user.click(buttons[0])

    // Simulate a key combo in the capture box
    const captureBox = screen.getByText(/press your shortcut/i).closest('div[tabindex]')!
    fireKeyDown(captureBox, { key: 'K', metaKey: true, shiftKey: true })

    await waitFor(() => expect(screen.queryByText(/press your shortcut/i)).not.toBeInTheDocument())
    const saveBtn = screen.getByRole('button', { name: /save/i })
    expect(saveBtn).not.toBeDisabled()

    await user.click(saveBtn)
    await waitFor(() => expect(window.electronAPI.setHotkey).toHaveBeenCalledWith('Command+Shift+K'))
    expect(screen.queryByText(/press your shortcut/i)).not.toBeInTheDocument()
  })

  it('calls setScreenshotHotkey when saving from the screenshot row', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    const buttons = await screen.findAllByText(/change shortcut/i)
    await user.click(buttons[1]) // Screenshot row

    const captureBox = screen.getByText(/press your shortcut/i).closest('div[tabindex]')!
    fireKeyDown(captureBox, { key: 'P', metaKey: true })

    await waitFor(() => expect(screen.queryByText(/press your shortcut/i)).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(window.electronAPI.setScreenshotHotkey).toHaveBeenCalledWith('Command+P'))
  })

  it('calls setUploadHotkey when saving from the upload row', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    const buttons = await screen.findAllByText(/change shortcut/i)
    await user.click(buttons[2]) // Upload row

    const captureBox = screen.getByText(/press your shortcut/i).closest('div[tabindex]')!
    fireKeyDown(captureBox, { key: 'I', metaKey: true })

    await waitFor(() => expect(screen.queryByText(/press your shortcut/i)).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(window.electronAPI.setUploadHotkey).toHaveBeenCalledWith('Command+I'))
  })

  it('shows an error when setHotkey returns false', async () => {
    window.electronAPI.setHotkey = vi.fn().mockResolvedValue(false)
    const user = userEvent.setup()
    render(<HotkeySettings />)

    const buttons = await screen.findAllByText(/change shortcut/i)
    await user.click(buttons[0])

    const captureBox = screen.getByText(/press your shortcut/i).closest('div[tabindex]')!
    fireKeyDown(captureBox, { key: 'K', metaKey: true })

    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText(/already in use/i)).toBeInTheDocument())
  })
})

// Helper: fire a keydown event on an element
function fireKeyDown(
  el: Element,
  opts: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }
) {
  el.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: opts.key,
      metaKey: opts.metaKey ?? false,
      ctrlKey: opts.ctrlKey ?? false,
      altKey: opts.altKey ?? false,
      shiftKey: opts.shiftKey ?? false,
      bubbles: true
    })
  )
}
