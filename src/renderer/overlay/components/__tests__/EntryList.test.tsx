import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EntryList } from '../EntryList'
import type { JournalEntry } from '../../../../../shared/ipc-types'

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    investigation_id: 'inv-1',
    body: 'Test entry',
    created_at: '2024-01-01 10:00:00',
    ...overrides
  }
}

describe('EntryList', () => {
  let onEntryUpdated: ReturnType<typeof vi.fn>
  let onEntryDeleted: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onEntryUpdated = vi.fn()
    onEntryDeleted = vi.fn()
    window.confirm = vi.fn().mockReturnValue(true)
  })

  it('shows empty state when there are no entries', () => {
    render(<EntryList entries={[]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })

  it('renders each entry body', () => {
    const entries = [
      makeEntry({ id: '1', body: 'First note' }),
      makeEntry({ id: '2', body: 'Second note' })
    ]
    render(<EntryList entries={entries} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)
    expect(screen.getByText('First note')).toBeInTheDocument()
    expect(screen.getByText('Second note')).toBeInTheDocument()
  })

  describe('delete', () => {
    it('prompts for confirmation before deleting', async () => {
      const user = userEvent.setup()
      const entry = makeEntry()
      window.electronAPI.deleteEntry = vi.fn().mockResolvedValue(undefined)

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      const deleteBtn = screen.getByTitle('Delete')
      await user.click(deleteBtn)

      expect(window.confirm).toHaveBeenCalled()
    })

    it('calls deleteEntry and onEntryDeleted when confirmed', async () => {
      const user = userEvent.setup()
      const entry = makeEntry()
      window.electronAPI.deleteEntry = vi.fn().mockResolvedValue(undefined)
      ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true)

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Delete'))
      await waitFor(() => expect(window.electronAPI.deleteEntry).toHaveBeenCalledWith('entry-1'))
      expect(onEntryDeleted).toHaveBeenCalledWith('entry-1')
    })

    it('does not delete when confirmation is cancelled', async () => {
      const user = userEvent.setup()
      const entry = makeEntry()
      window.electronAPI.deleteEntry = vi.fn()
      ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false)

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Delete'))
      expect(window.electronAPI.deleteEntry).not.toHaveBeenCalled()
      expect(onEntryDeleted).not.toHaveBeenCalled()
    })
  })

  describe('edit', () => {
    it('enters edit mode on clicking the edit button', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Original text' })

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      expect(screen.getByRole('textbox')).toHaveValue('Original text')
    })

    it('enters edit mode on double-clicking the entry text', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Double click me' })

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.dblClick(screen.getByText('Double click me'))
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('saves edited text on Enter', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Old text' })
      const updated = { ...entry, body: 'New text' }
      window.electronAPI.updateEntry = vi.fn().mockResolvedValue(updated)

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'New text')
      await user.keyboard('{Enter}')

      await waitFor(() =>
        expect(window.electronAPI.updateEntry).toHaveBeenCalledWith('entry-1', 'New text')
      )
      expect(onEntryUpdated).toHaveBeenCalledWith(updated)
    })

    it('cancels edit on Escape without saving', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Stay the same' })
      window.electronAPI.updateEntry = vi.fn()

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      await user.type(screen.getByRole('textbox'), ' modified')
      await user.keyboard('{Escape}')

      expect(window.electronAPI.updateEntry).not.toHaveBeenCalled()
      expect(screen.getByText('Stay the same')).toBeInTheDocument()
    })

    it('cancels edit on clicking Cancel button', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Original' })
      window.electronAPI.updateEntry = vi.fn()

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      await user.click(screen.getByText('Cancel'))

      expect(window.electronAPI.updateEntry).not.toHaveBeenCalled()
      expect(screen.getByText('Original')).toBeInTheDocument()
    })

    it('does not save if the text is unchanged', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Same text' })
      window.electronAPI.updateEntry = vi.fn()

      render(<EntryList entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      await user.keyboard('{Enter}')

      expect(window.electronAPI.updateEntry).not.toHaveBeenCalled()
    })
  })
})
