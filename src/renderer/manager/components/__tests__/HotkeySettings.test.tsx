import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { HotkeySettings } from '../HotkeySettings'

describe('HotkeySettings', () => {
  beforeEach(() => {
    window.electronAPI.getHotkey = vi.fn().mockResolvedValue('CommandOrControl+Shift+J')
    window.electronAPI.setHotkey = vi.fn().mockResolvedValue(true)
  })

  it('loads and displays the current hotkey', async () => {
    render(<HotkeySettings />)
    await waitFor(() => expect(window.electronAPI.getHotkey).toHaveBeenCalled())
    // The hotkey parts should be rendered as key badges
    expect(await screen.findByText('⌘')).toBeInTheDocument()
    expect(screen.getByText('⇧')).toBeInTheDocument()
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('shows the "Change shortcut" button', async () => {
    render(<HotkeySettings />)
    expect(await screen.findByText(/change shortcut/i)).toBeInTheDocument()
  })

  it('enters capture mode when "Change shortcut" is clicked', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    await user.click(await screen.findByText(/change shortcut/i))
    expect(screen.getByText(/press your shortcut/i)).toBeInTheDocument()
  })

  it('shows Save and Cancel buttons in capture mode', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    await user.click(await screen.findByText(/change shortcut/i))
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('exits capture mode on Cancel without saving', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    await user.click(await screen.findByText(/change shortcut/i))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByText(/press your shortcut/i)).not.toBeInTheDocument()
    expect(window.electronAPI.setHotkey).not.toHaveBeenCalled()
  })

  it('Save button is disabled until a shortcut is captured', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    await user.click(await screen.findByText(/change shortcut/i))
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('calls setHotkey and exits capture mode on Save', async () => {
    const user = userEvent.setup()
    render(<HotkeySettings />)

    await user.click(await screen.findByText(/change shortcut/i))

    // Simulate a key combo in the capture box
    const captureBox = screen.getByText(/press your shortcut/i).closest('div[tabindex]')!
    fireKeyDown(captureBox, { key: 'K', metaKey: true, shiftKey: true })

    await waitFor(() => expect(screen.queryByText(/press your shortcut/i)).not.toBeInTheDocument())
    // Save button should now be enabled
    const saveBtn = screen.getByRole('button', { name: /save/i })
    expect(saveBtn).not.toBeDisabled()

    await user.click(saveBtn)
    await waitFor(() => expect(window.electronAPI.setHotkey).toHaveBeenCalledWith('Command+Shift+K'))
    expect(screen.queryByText(/press your shortcut/i)).not.toBeInTheDocument()
  })

  it('shows an error when setHotkey returns false', async () => {
    window.electronAPI.setHotkey = vi.fn().mockResolvedValue(false)
    const user = userEvent.setup()
    render(<HotkeySettings />)

    await user.click(await screen.findByText(/change shortcut/i))

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
