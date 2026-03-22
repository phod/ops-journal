import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { FolderTreePicker } from '../FolderTreePicker'
import type { ToolFolder } from '@shared/ipc-types'

function makeFolder(overrides: Partial<ToolFolder> = {}): ToolFolder {
  return {
    id: 'folder-1',
    name: 'Scripts',
    parent_id: null,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

describe('FolderTreePicker', () => {
  it('renders "No folder" option', () => {
    render(<FolderTreePicker folders={[]} selectedFolderId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('No folder')).toBeInTheDocument()
  })

  it('renders folders', () => {
    const folders = [
      makeFolder({ id: 'f1', name: 'Scripts' }),
      makeFolder({ id: 'f2', name: 'Links' })
    ]
    render(<FolderTreePicker folders={folders} selectedFolderId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Scripts')).toBeInTheDocument()
    expect(screen.getByText('Links')).toBeInTheDocument()
  })

  it('renders nested folders indented', () => {
    const folders = [
      makeFolder({ id: 'f1', name: 'Parent' }),
      makeFolder({ id: 'f2', name: 'Child', parent_id: 'f1' })
    ]
    render(<FolderTreePicker folders={folders} selectedFolderId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('shows checkmark on selected folder', () => {
    const folders = [makeFolder({ id: 'f1', name: 'Scripts' })]
    render(<FolderTreePicker folders={folders} selectedFolderId="f1" onSelect={vi.fn()} />)
    const button = screen.getByText('Scripts').closest('button')!
    expect(button.textContent).toContain('✓')
  })

  it('shows checkmark on "No folder" when null is selected', () => {
    const folders = [makeFolder({ id: 'f1', name: 'Scripts' })]
    render(<FolderTreePicker folders={folders} selectedFolderId={null} onSelect={vi.fn()} />)
    const button = screen.getByText('No folder').closest('button')!
    expect(button.textContent).toContain('✓')
  })

  it('calls onSelect with folder id when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const folders = [makeFolder({ id: 'f1', name: 'Scripts' })]
    render(<FolderTreePicker folders={folders} selectedFolderId={null} onSelect={onSelect} />)

    await user.click(screen.getByText('Scripts'))
    expect(onSelect).toHaveBeenCalledWith('f1')
  })

  it('calls onSelect with null when "No folder" is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const folders = [makeFolder({ id: 'f1', name: 'Scripts' })]
    render(<FolderTreePicker folders={folders} selectedFolderId="f1" onSelect={onSelect} />)

    await user.click(screen.getByText('No folder'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
