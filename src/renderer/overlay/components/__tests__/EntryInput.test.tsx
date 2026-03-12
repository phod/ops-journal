import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EntryInput } from '../EntryInput'
import type { Investigation, JournalEntry } from '../../../../../shared/ipc-types'

const mockInvestigation: Investigation = {
  id: 'inv-1',
  name: 'Test Investigation',
  is_active: 1,
  created_at: '2024-01-01 10:00:00'
}

const mockEntry: JournalEntry = {
  id: 'entry-1',
  investigation_id: 'inv-1',
  body: 'Test note',
  created_at: '2024-01-01 10:01:00'
}

describe('EntryInput', () => {
  let onEntryCreated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onEntryCreated = vi.fn()
    window.electronAPI.createEntry = vi.fn().mockResolvedValue(mockEntry)
  })

  it('renders the textarea', () => {
    render(<EntryInput activeInvestigation={mockInvestigation} onEntryCreated={onEntryCreated} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('submits on Enter and calls onEntryCreated', async () => {
    const user = userEvent.setup()
    render(<EntryInput activeInvestigation={mockInvestigation} onEntryCreated={onEntryCreated} />)

    await user.type(screen.getByRole('textbox'), 'My log entry')
    await user.keyboard('{Enter}')

    expect(window.electronAPI.createEntry).toHaveBeenCalledWith('inv-1', 'My log entry')
    expect(onEntryCreated).toHaveBeenCalledWith(mockEntry)
  })

  it('clears the input after submit', async () => {
    const user = userEvent.setup()
    render(<EntryInput activeInvestigation={mockInvestigation} onEntryCreated={onEntryCreated} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Something')
    await user.keyboard('{Enter}')

    expect(textarea).toHaveValue('')
  })

  it('does not submit empty or whitespace-only input', async () => {
    const user = userEvent.setup()
    render(<EntryInput activeInvestigation={mockInvestigation} onEntryCreated={onEntryCreated} />)

    await user.keyboard('{Enter}')
    expect(window.electronAPI.createEntry).not.toHaveBeenCalled()

    await user.type(screen.getByRole('textbox'), '   ')
    await user.keyboard('{Enter}')
    expect(window.electronAPI.createEntry).not.toHaveBeenCalled()
  })

  it('inserts a newline on Shift+Enter', async () => {
    const user = userEvent.setup()
    render(<EntryInput activeInvestigation={mockInvestigation} onEntryCreated={onEntryCreated} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'line one')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textarea, 'line two')

    expect(textarea).toHaveValue('line one\nline two')
    expect(window.electronAPI.createEntry).not.toHaveBeenCalled()
  })

  it('trims whitespace before submitting', async () => {
    const user = userEvent.setup()
    render(<EntryInput activeInvestigation={mockInvestigation} onEntryCreated={onEntryCreated} />)

    await user.type(screen.getByRole('textbox'), '  trimmed  ')
    await user.keyboard('{Enter}')

    expect(window.electronAPI.createEntry).toHaveBeenCalledWith('inv-1', 'trimmed')
  })
})
