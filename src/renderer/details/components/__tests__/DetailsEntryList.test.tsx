import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DetailsEntryList } from '../DetailsEntryList'
import type { JournalEntry } from '@shared/ipc-types'

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    investigation_id: 'inv-1',
    body: 'Test entry',
    image_paths: [],
    created_at: '2024-01-01 10:00:00',
    type: 'note',
    ...overrides
  }
}

describe('DetailsEntryList', () => {
  let onEntryUpdated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onEntryUpdated = vi.fn()
  })

  it('shows empty state when there are no entries', () => {
    render(<DetailsEntryList entries={[]} />)
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })

  it('renders each entry body', () => {
    const entries = [
      makeEntry({ id: '1', body: 'First finding' }),
      makeEntry({ id: '2', body: 'Second finding' })
    ]
    render(<DetailsEntryList entries={entries} />)
    expect(screen.getByText('First finding')).toBeInTheDocument()
    expect(screen.getByText('Second finding')).toBeInTheDocument()
  })

  it('shows ACTION badge for action entries', () => {
    const entry = makeEntry({ type: 'action' })
    render(<DetailsEntryList entries={[entry]} />)
    expect(screen.getByTooltip('Change entry type')).toHaveTextContent('ACTION')
  })

  it('shows FINDING badge for finding entries', () => {
    const entry = makeEntry({ type: 'finding' })
    render(<DetailsEntryList entries={[entry]} />)
    expect(screen.getByTooltip('Change entry type')).toHaveTextContent('FINDING')
  })

  it('shows a tag icon for note entries instead of a colored badge', () => {
    const entry = makeEntry({ type: 'note' })
    render(<DetailsEntryList entries={[entry]} />)
    expect(screen.queryByTooltip('Change entry type')).not.toBeInTheDocument()
    expect(screen.getByTooltip('Set entry type')).toBeInTheDocument()
  })

  it('opens the type picker menu when the badge is clicked', async () => {
    const user = userEvent.setup()
    const entry = makeEntry({ type: 'action' })
    render(<DetailsEntryList entries={[entry]} onEntryUpdated={onEntryUpdated} />)

    await user.click(screen.getByTooltip('Change entry type'))

    expect(screen.getByText('NOTE')).toBeInTheDocument()
    expect(screen.getByText('FINDING')).toBeInTheDocument()
  })

  it('calls updateEntry and onEntryUpdated when type is changed', async () => {
    const user = userEvent.setup()
    const entry = makeEntry({ id: 'entry-1', body: 'Test entry', type: 'action' })
    const updated = makeEntry({ id: 'entry-1', body: 'Test entry', type: 'finding' })
    window.electronAPI.updateEntry = vi.fn().mockResolvedValue(updated)

    render(<DetailsEntryList entries={[entry]} onEntryUpdated={onEntryUpdated} />)

    await user.click(screen.getByTooltip('Change entry type'))
    fireEvent.mouseDown(screen.getByText('FINDING').closest('button')!)

    await waitFor(() =>
      expect(window.electronAPI.updateEntry).toHaveBeenCalledWith('entry-1', 'Test entry', undefined, 'finding')
    )
    expect(onEntryUpdated).toHaveBeenCalledWith(updated)
  })

  it('does not call updateEntry when the same type is selected', async () => {
    const user = userEvent.setup()
    const entry = makeEntry({ id: 'entry-1', type: 'action' })

    render(<DetailsEntryList entries={[entry]} onEntryUpdated={onEntryUpdated} />)

    await user.click(screen.getByTooltip('Change entry type'))
    // Find the ACTION option in the menu (no title attribute, text includes ACTION)
    const menuActionBtn = screen.getAllByRole('button').find(
      (btn) => btn.textContent?.includes('ACTION') && !btn.title
    )
    fireEvent.mouseDown(menuActionBtn!)

    expect(window.electronAPI.updateEntry).not.toHaveBeenCalled()
  })
})
