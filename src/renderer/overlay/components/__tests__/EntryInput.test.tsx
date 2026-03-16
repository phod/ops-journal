import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EntryInput } from '../EntryInput'
import type { Investigation, JournalEntry } from '@shared/ipc-types'
import { MAX_IMAGES_PER_ENTRY } from '@shared/ipc-types'

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
  image_paths: [],
  created_at: '2024-01-01 10:01:00',
  type: 'note'
}

// Wrapper that manages pendingImages state as the real parent would
function Wrapper({
  onEntryCreated
}: {
  onEntryCreated: (entry: JournalEntry) => void
}) {
  const [pendingImages, setPendingImages] = useState<string[]>([])
  return (
    <EntryInput
      activeInvestigation={mockInvestigation}
      entries={[]}
      editingEntryId={null}
      onSetEditingEntryId={() => {}}
      onEntryCreated={onEntryCreated}
      pendingImages={pendingImages}
      onPendingImagesChange={setPendingImages}
    />
  )
}

describe('EntryInput', () => {
  let onEntryCreated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onEntryCreated = vi.fn()
    window.electronAPI.createEntry = vi.fn().mockResolvedValue(mockEntry)
  })

  it('renders the textarea', () => {
    render(<Wrapper onEntryCreated={onEntryCreated} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders Upload and Screenshot buttons', () => {
    render(<Wrapper onEntryCreated={onEntryCreated} />)
    expect(screen.getByTitle('Attach image')).toBeInTheDocument()
    expect(screen.getByTitle('Capture screenshot region')).toBeInTheDocument()
  })

  it('submits on Enter and calls onEntryCreated', async () => {
    const user = userEvent.setup()
    render(<Wrapper onEntryCreated={onEntryCreated} />)

    await user.type(screen.getByRole('textbox'), 'My log entry')
    await user.keyboard('{Enter}')

    expect(window.electronAPI.createEntry).toHaveBeenCalledWith('inv-1', 'My log entry', undefined, 'note')
    expect(onEntryCreated).toHaveBeenCalledWith(mockEntry)
  })

  it('clears the input after submit', async () => {
    const user = userEvent.setup()
    render(<Wrapper onEntryCreated={onEntryCreated} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Something')
    await user.keyboard('{Enter}')

    expect(textarea).toHaveValue('')
  })

  it('does not submit empty or whitespace-only input with no image', async () => {
    const user = userEvent.setup()
    render(<Wrapper onEntryCreated={onEntryCreated} />)

    await user.keyboard('{Enter}')
    expect(window.electronAPI.createEntry).not.toHaveBeenCalled()

    await user.type(screen.getByRole('textbox'), '   ')
    await user.keyboard('{Enter}')
    expect(window.electronAPI.createEntry).not.toHaveBeenCalled()
  })

  it('inserts a newline on Shift+Enter', async () => {
    const user = userEvent.setup()
    render(<Wrapper onEntryCreated={onEntryCreated} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'line one')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textarea, 'line two')

    expect(textarea).toHaveValue('line one\nline two')
    expect(window.electronAPI.createEntry).not.toHaveBeenCalled()
  })

  it('trims whitespace before submitting', async () => {
    const user = userEvent.setup()
    render(<Wrapper onEntryCreated={onEntryCreated} />)

    await user.type(screen.getByRole('textbox'), '  trimmed  ')
    await user.keyboard('{Enter}')

    expect(window.electronAPI.createEntry).toHaveBeenCalledWith('inv-1', 'trimmed', undefined, 'note')
  })

  describe('image attachment', () => {
    it('shows image preview after picking an image', async () => {
      const user = userEvent.setup()
      const dataUrl = 'data:image/png;base64,iVBOR'
      window.electronAPI.pickImage = vi.fn().mockResolvedValue([dataUrl])

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))

      await waitFor(() => {
        expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument()
      })
      expect(screen.getByAltText('Pending attachment 1')).toHaveAttribute('src', dataUrl)
    })

    it('does not show preview when pickImage returns empty array', async () => {
      const user = userEvent.setup()
      window.electronAPI.pickImage = vi.fn().mockResolvedValue([])

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))

      expect(screen.queryByAltText('Pending attachment 1')).not.toBeInTheDocument()
    })

    it('shows multiple previews after picking multiple images', async () => {
      const user = userEvent.setup()
      const dataUrls = ['data:image/png;base64,a', 'data:image/png;base64,b']
      window.electronAPI.pickImage = vi.fn().mockResolvedValue(dataUrls)

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))

      await waitFor(() => {
        expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument()
        expect(screen.getByAltText('Pending attachment 2')).toBeInTheDocument()
      })
    })

    it('shows image preview after capturing a screenshot', async () => {
      const user = userEvent.setup()
      const dataUrl = 'data:image/png;base64,screenshot'
      window.electronAPI.captureScreenshot = vi.fn().mockResolvedValue(dataUrl)

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Capture screenshot region'))

      await waitFor(() => {
        expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument()
      })
    })

    it('removes an individual pending image when × is clicked', async () => {
      const user = userEvent.setup()
      window.electronAPI.pickImage = vi.fn().mockResolvedValue(['data:image/png;base64,x'])

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))
      await waitFor(() => expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument())

      await user.click(screen.getByTitle('Remove image'))

      expect(screen.queryByAltText('Pending attachment 1')).not.toBeInTheDocument()
    })

    it('submits with imageDataUrls array when pending images are present', async () => {
      const user = userEvent.setup()
      const dataUrl = 'data:image/png;base64,img'
      window.electronAPI.pickImage = vi.fn().mockResolvedValue([dataUrl])

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))
      await waitFor(() => expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument())

      await user.type(screen.getByRole('textbox'), 'Note with image')
      await user.keyboard('{Enter}')

      expect(window.electronAPI.createEntry).toHaveBeenCalledWith('inv-1', 'Note with image', [dataUrl], 'note')
    })

    it('can submit with only images and no text', async () => {
      const user = userEvent.setup()
      const dataUrl = 'data:image/png;base64,img'
      window.electronAPI.pickImage = vi.fn().mockResolvedValue([dataUrl])

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))
      await waitFor(() => expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument())

      await user.click(screen.getByRole('textbox'))
      await user.keyboard('{Enter}')

      expect(window.electronAPI.createEntry).toHaveBeenCalledWith('inv-1', '', [dataUrl], 'note')
    })

    it('clears pending images after successful submit', async () => {
      const user = userEvent.setup()
      const dataUrl = 'data:image/png;base64,img'
      window.electronAPI.pickImage = vi.fn().mockResolvedValue([dataUrl])

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))
      await waitFor(() => expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument())

      await user.type(screen.getByRole('textbox'), 'hi')
      await user.keyboard('{Enter}')

      await waitFor(() => expect(screen.queryByAltText('Pending attachment 1')).not.toBeInTheDocument())
    })

    it('restores pending images on submit error', async () => {
      const user = userEvent.setup()
      const dataUrl = 'data:image/png;base64,img'
      window.electronAPI.pickImage = vi.fn().mockResolvedValue([dataUrl])
      window.electronAPI.createEntry = vi.fn().mockRejectedValue(new Error('fail'))

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))
      await waitFor(() => expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument())

      await user.type(screen.getByRole('textbox'), 'some text')
      await user.keyboard('{Enter}')

      await waitFor(() => expect(screen.getByAltText('Pending attachment 1')).toBeInTheDocument())
    })

    it('shows limit warning and disables buttons at MAX_IMAGES_PER_ENTRY', async () => {
      const user = userEvent.setup()
      const dataUrls = Array.from({ length: MAX_IMAGES_PER_ENTRY }, (_, i) => `data:image/png;base64,img${i}`)
      window.electronAPI.pickImage = vi.fn().mockResolvedValue(dataUrls)

      render(<Wrapper onEntryCreated={onEntryCreated} />)

      await user.click(screen.getByTitle('Attach image'))

      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Image limit reached`))).toBeInTheDocument()
      })

      const limitedButtons = screen.getAllByTitle(`Image limit reached (${MAX_IMAGES_PER_ENTRY})`)
      expect(limitedButtons.length).toBeGreaterThan(0)
      for (const btn of limitedButtons) expect(btn).toBeDisabled()
    })
  })

  describe('slash commands', () => {
    it('shows autocomplete dropdown when typing /', async () => {
      const user = userEvent.setup()
      render(<Wrapper onEntryCreated={onEntryCreated} />)
      await user.type(screen.getByRole('textbox'), '/')
      expect(screen.getByText('/action')).toBeInTheDocument()
      expect(screen.getByText('/finding')).toBeInTheDocument()
    })

    it('filters completions by prefix', async () => {
      const user = userEvent.setup()
      render(<Wrapper onEntryCreated={onEntryCreated} />)
      await user.type(screen.getByRole('textbox'), '/a')
      expect(screen.getByText('/action')).toBeInTheDocument()
      expect(screen.queryByText('/finding')).not.toBeInTheDocument()
    })

    it('applies completion and sets value on Tab', async () => {
      const user = userEvent.setup()
      render(<Wrapper onEntryCreated={onEntryCreated} />)
      await user.type(screen.getByRole('textbox'), '/')
      await user.keyboard('{Tab}')
      expect(screen.getByRole('textbox')).toHaveValue('/action ')
    })

    it('dismisses autocomplete on Escape', async () => {
      const user = userEvent.setup()
      render(<Wrapper onEntryCreated={onEntryCreated} />)
      await user.type(screen.getByRole('textbox'), '/')
      expect(screen.getByText('/action')).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.queryByText('/action')).not.toBeInTheDocument()
    })

    it('submits /action command as action type with stripped body', async () => {
      const user = userEvent.setup()
      render(<Wrapper onEntryCreated={onEntryCreated} />)
      await user.type(screen.getByRole('textbox'), '/action restarted service')
      await user.keyboard('{Escape}')
      await user.keyboard('{Enter}')
      expect(window.electronAPI.createEntry).toHaveBeenCalledWith(
        'inv-1', 'restarted service', undefined, 'action'
      )
    })

    it('submits /finding command as finding type with stripped body', async () => {
      const user = userEvent.setup()
      render(<Wrapper onEntryCreated={onEntryCreated} />)
      await user.type(screen.getByRole('textbox'), '/finding root cause identified')
      await user.keyboard('{Escape}')
      await user.keyboard('{Enter}')
      expect(window.electronAPI.createEntry).toHaveBeenCalledWith(
        'inv-1', 'root cause identified', undefined, 'finding'
      )
    })

    it('shows type badge when an action command is active', async () => {
      const user = userEvent.setup()
      render(<Wrapper onEntryCreated={onEntryCreated} />)
      await user.type(screen.getByRole('textbox'), '/action ')
      // Dismiss autocomplete so only the badge remains
      await user.keyboard('{Escape}')
      expect(screen.getByText('ACTION')).toBeInTheDocument()
    })

    it('does not show type badge for plain text', async () => {
      const user = userEvent.setup()
      render(<Wrapper onEntryCreated={onEntryCreated} />)
      await user.type(screen.getByRole('textbox'), 'just a note')
      expect(screen.queryByText('ACTION')).not.toBeInTheDocument()
      expect(screen.queryByText('FINDING')).not.toBeInTheDocument()
    })
  })
})
