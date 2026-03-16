import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EntryList } from '../EntryList'
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

// Wrapper that manages editingEntryId state as the real parent would
function Wrapper({
  entries,
  onEntryUpdated,
  onEntryDeleted
}: {
  entries: JournalEntry[]
  onEntryUpdated: (entry: JournalEntry) => void
  onEntryDeleted: (id: string) => void
}) {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  return (
    <EntryList
      entries={entries}
      editingEntryId={editingEntryId}
      onEditingEntryIdChange={setEditingEntryId}
      onEntryUpdated={onEntryUpdated}
      onEntryDeleted={onEntryDeleted}
    />
  )
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
    render(<Wrapper entries={[]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })

  it('renders each entry body', () => {
    const entries = [
      makeEntry({ id: '1', body: 'First note' }),
      makeEntry({ id: '2', body: 'Second note' })
    ]
    render(<Wrapper entries={entries} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)
    expect(screen.getByText('First note')).toBeInTheDocument()
    expect(screen.getByText('Second note')).toBeInTheDocument()
  })

  describe('image display', () => {
    it('loads and shows images when image_paths is set', async () => {
      const dataUrl = 'data:image/png;base64,abc123'
      window.electronAPI.getEntryImage = vi.fn().mockResolvedValue(dataUrl)

      const entry = makeEntry({ image_paths: ['/some/path.png'] })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await waitFor(() => {
        const img = screen.getByAltText('Attached')
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', dataUrl)
      })
    })

    it('does not show images when image_paths is empty', () => {
      window.electronAPI.getEntryImage = vi.fn()
      const entry = makeEntry({ image_paths: [] })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      expect(screen.queryByAltText('Attached')).not.toBeInTheDocument()
      expect(window.electronAPI.getEntryImage).not.toHaveBeenCalled()
    })

    it('loads and shows multiple images', async () => {
      const dataUrls = ['data:image/png;base64,a', 'data:image/png;base64,b']
      window.electronAPI.getEntryImage = vi.fn()
        .mockResolvedValueOnce(dataUrls[0])
        .mockResolvedValueOnce(dataUrls[1])

      const entry = makeEntry({ image_paths: ['/a.png', '/b.png'] })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await waitFor(() => {
        expect(screen.getAllByAltText('Attached')).toHaveLength(2)
      })
    })

    it('toggles image expansion on click', async () => {
      const dataUrl = 'data:image/png;base64,abc'
      window.electronAPI.getEntryImage = vi.fn().mockResolvedValue(dataUrl)

      const entry = makeEntry({ image_paths: ['/img.png'] })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      const img = await screen.findByAltText('Attached')
      expect(img).toHaveClass('max-h-24')

      fireEvent.click(img)
      expect(img).not.toHaveClass('max-h-24')

      fireEvent.click(img)
      expect(img).toHaveClass('max-h-24')
    })
  })

  describe('delete', () => {
    it('prompts for confirmation before deleting', async () => {
      const user = userEvent.setup()
      const entry = makeEntry()
      window.electronAPI.deleteEntry = vi.fn().mockResolvedValue(undefined)

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      const deleteBtn = screen.getByTitle('Delete')
      await user.click(deleteBtn)

      expect(window.confirm).toHaveBeenCalled()
    })

    it('calls deleteEntry and onEntryDeleted when confirmed', async () => {
      const user = userEvent.setup()
      const entry = makeEntry()
      window.electronAPI.deleteEntry = vi.fn().mockResolvedValue(undefined)
      ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true)

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Delete'))
      await waitFor(() => expect(window.electronAPI.deleteEntry).toHaveBeenCalledWith('entry-1'))
      expect(onEntryDeleted).toHaveBeenCalledWith('entry-1')
    })

    it('does not delete when confirmation is cancelled', async () => {
      const user = userEvent.setup()
      const entry = makeEntry()
      window.electronAPI.deleteEntry = vi.fn()
      ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false)

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Delete'))
      expect(window.electronAPI.deleteEntry).not.toHaveBeenCalled()
      expect(onEntryDeleted).not.toHaveBeenCalled()
    })
  })

  describe('edit', () => {
    it('enters edit mode on clicking the edit button', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Original text' })

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      expect(screen.getByRole('textbox')).toHaveValue('Original text')
    })

    it('enters edit mode on double-clicking the entry text', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Double click me' })

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.dblClick(screen.getByText('Double click me'))
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('saves edited text on Enter', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Old text' })
      const updated = { ...entry, body: 'New text' }
      window.electronAPI.updateEntry = vi.fn().mockResolvedValue(updated)

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'New text')
      await user.keyboard('{Enter}')

      await waitFor(() =>
        expect(window.electronAPI.updateEntry).toHaveBeenCalledWith('entry-1', 'New text', undefined, undefined)
      )
      expect(onEntryUpdated).toHaveBeenCalledWith(updated)
    })

    it('cancels edit on Escape without saving', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Stay the same' })
      window.electronAPI.updateEntry = vi.fn()

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

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

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      await user.click(screen.getByText('Cancel'))

      expect(window.electronAPI.updateEntry).not.toHaveBeenCalled()
      expect(screen.getByText('Original')).toBeInTheDocument()
    })

    it('does not save if the text is unchanged and no image change', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ body: 'Same text' })
      window.electronAPI.updateEntry = vi.fn()

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Edit'))
      await user.keyboard('{Enter}')

      expect(window.electronAPI.updateEntry).not.toHaveBeenCalled()
    })

    it('shows remove button for each image in edit mode', async () => {
      const dataUrl = 'data:image/png;base64,abc'
      window.electronAPI.getEntryImage = vi.fn().mockResolvedValue(dataUrl)
      window.electronAPI.updateEntry = vi.fn()

      const entry = makeEntry({ image_paths: ['/img.png'] })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await screen.findByAltText('Attached')

      const user = userEvent.setup()
      await user.click(screen.getByTitle('Edit'))

      await waitFor(() => expect(screen.getByTitle('Remove image')).toBeInTheDocument())
    })

    it('shows removal count message after marking an image for removal', async () => {
      const dataUrl = 'data:image/png;base64,abc'
      window.electronAPI.getEntryImage = vi.fn().mockResolvedValue(dataUrl)
      window.electronAPI.updateEntry = vi.fn().mockResolvedValue(makeEntry({ image_paths: [] }))

      const entry = makeEntry({ image_paths: ['/img.png'] })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await screen.findByAltText('Attached')

      const user = userEvent.setup()
      await user.click(screen.getByTitle('Edit'))
      await waitFor(() => expect(screen.getByTitle('Remove image')).toBeInTheDocument())
      await user.click(screen.getByTitle('Remove image'))

      expect(screen.getByText(/image will be removed on save/i)).toBeInTheDocument()
    })

    it('sends keepImagePaths without the removed path on save', async () => {
      const dataUrl = 'data:image/png;base64,abc'
      window.electronAPI.getEntryImage = vi.fn().mockResolvedValue(dataUrl)
      const updatedEntry = makeEntry({ body: 'Same text', image_paths: [] })
      window.electronAPI.updateEntry = vi.fn().mockResolvedValue(updatedEntry)

      const entry = makeEntry({ body: 'Same text', image_paths: ['/img.png'] })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await screen.findByAltText('Attached')

      const user = userEvent.setup()
      await user.click(screen.getByTitle('Edit'))
      await waitFor(() => expect(screen.getByTitle('Remove image')).toBeInTheDocument())
      await user.click(screen.getByTitle('Remove image'))

      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() =>
        expect(window.electronAPI.updateEntry).toHaveBeenCalledWith('entry-1', 'Same text', [], undefined)
      )
    })

    it('resets pending removals on cancel', async () => {
      const dataUrl = 'data:image/png;base64,abc'
      window.electronAPI.getEntryImage = vi.fn().mockResolvedValue(dataUrl)

      const entry = makeEntry({ image_paths: ['/img.png'] })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await screen.findByAltText('Attached')

      const user = userEvent.setup()
      await user.click(screen.getByTitle('Edit'))
      await waitFor(() => expect(screen.getByTitle('Remove image')).toBeInTheDocument())
      await user.click(screen.getByTitle('Remove image'))
      expect(screen.getByText(/image will be removed on save/i)).toBeInTheDocument()

      await user.click(screen.getByText('Cancel'))

      expect(screen.queryByText(/image will be removed on save/i)).not.toBeInTheDocument()
    })
  })

  describe('entry type badge', () => {
    it('shows ACTION badge for action entries', () => {
      const entry = makeEntry({ type: 'action' })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)
      expect(screen.getByTitle('Change entry type')).toHaveTextContent('ACTION')
    })

    it('shows FINDING badge for finding entries', () => {
      const entry = makeEntry({ type: 'finding' })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)
      expect(screen.getByTitle('Change entry type')).toHaveTextContent('FINDING')
    })

    it('shows a tag icon for note entries instead of a colored badge', () => {
      const entry = makeEntry({ type: 'note' })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)
      expect(screen.queryByTitle('Change entry type')).not.toBeInTheDocument()
      expect(screen.getByTitle('Set entry type')).toBeInTheDocument()
    })

    it('opens the type picker menu when the badge is clicked', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ type: 'action' })
      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Change entry type'))

      expect(screen.getByText('NOTE')).toBeInTheDocument()
      expect(screen.getByText('FINDING')).toBeInTheDocument()
    })

    it('calls updateEntry and onEntryUpdated when a different type is selected', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ id: 'entry-1', body: 'Test entry', type: 'action' })
      const updated = makeEntry({ id: 'entry-1', body: 'Test entry', type: 'finding' })
      window.electronAPI.updateEntry = vi.fn().mockResolvedValue(updated)

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Change entry type'))
      fireEvent.mouseDown(screen.getByText('FINDING').closest('button')!)

      await waitFor(() =>
        expect(window.electronAPI.updateEntry).toHaveBeenCalledWith('entry-1', 'Test entry', undefined, 'finding')
      )
      expect(onEntryUpdated).toHaveBeenCalledWith(updated)
    })

    it('does not call updateEntry when the same type is selected', async () => {
      const user = userEvent.setup()
      const entry = makeEntry({ id: 'entry-1', type: 'action' })

      render(<Wrapper entries={[entry]} onEntryUpdated={onEntryUpdated} onEntryDeleted={onEntryDeleted} />)

      await user.click(screen.getByTitle('Change entry type'))
      // Find the ACTION option in the menu (no title, contains ACTION text with checkmark)
      const menuActionBtn = screen.getAllByRole('button').find(
        (btn) => btn.textContent?.includes('ACTION') && !btn.title
      )
      fireEvent.mouseDown(menuActionBtn!)

      expect(window.electronAPI.updateEntry).not.toHaveBeenCalled()
    })
  })
})
