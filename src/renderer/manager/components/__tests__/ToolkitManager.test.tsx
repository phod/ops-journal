import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ToolkitManager } from '../ToolkitManager'
import type { Tool, ToolFolder } from '@shared/ipc-types'

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: 'tool-1',
    name: 'Grafana',
    tool_type: 'link',
    value: 'https://grafana.example.com',
    tags: ['monitoring'],
    folder_id: null,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

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

describe('ToolkitManager', () => {
  beforeEach(() => {
    window.electronAPI.listTools = vi.fn().mockResolvedValue([])
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue([])
    window.electronAPI.onToolsChanged = vi.fn().mockReturnValue(() => {})
    window.electronAPI.onToolFoldersChanged = vi.fn().mockReturnValue(() => {})
    window.electronAPI.onEntriesChanged = vi.fn().mockReturnValue(() => {})
    window.electronAPI.listPendingToolEntries = vi.fn().mockResolvedValue([])
  })

  it('shows empty state when no tools exist', async () => {
    render(<ToolkitManager />)
    await waitFor(() => expect(window.electronAPI.listTools).toHaveBeenCalled())
    expect(screen.getByText('No tools yet')).toBeInTheDocument()
  })

  it('renders a New Tool button', async () => {
    render(<ToolkitManager />)
    expect(screen.getByText('New Tool')).toBeInTheDocument()
  })

  it('renders tool cards when tools exist', async () => {
    const tools = [
      makeTool({ id: '1', name: 'Grafana' }),
      makeTool({ id: '2', name: 'kubectl pods', tool_type: 'string' })
    ]
    window.electronAPI.listTools = vi.fn().mockResolvedValue(tools)

    render(<ToolkitManager />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())
    expect(screen.getByText('kubectl pods')).toBeInTheDocument()
  })

  it('opens the tool form when New Tool is clicked', async () => {
    const user = userEvent.setup()
    render(<ToolkitManager />)

    await user.click(screen.getByText('New Tool'))
    expect(screen.getByText('New Tool', { selector: 'h3' })).toBeInTheDocument()
  })

  it('calls deleteTool when a tool deletion is confirmed', async () => {
    const tools = [makeTool({ id: 'tool-1', name: 'To Delete' })]
    window.electronAPI.listTools = vi.fn().mockResolvedValue(tools)
    window.electronAPI.deleteTool = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<ToolkitManager />)
    await waitFor(() => expect(screen.getByText('To Delete')).toBeInTheDocument())

    // Open overflow menu
    await user.click(screen.getByText('···'))
    await user.click(screen.getByText('Delete'))

    // Confirm deletion
    const confirmBtns = screen.getAllByText('Delete')
    await user.click(confirmBtns[confirmBtns.length - 1])

    expect(window.electronAPI.deleteTool).toHaveBeenCalledWith('tool-1')
  })

  it('subscribes to tools:changed events', () => {
    render(<ToolkitManager />)
    expect(window.electronAPI.onToolsChanged).toHaveBeenCalled()
  })

  it('renders grip handle on folder rows', async () => {
    const folders = [makeFolder({ id: 'f1', name: 'Scripts' })]
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue(folders)

    render(<ToolkitManager />)
    await waitFor(() => expect(screen.getByText('Scripts')).toBeInTheDocument())

    // Grip handle is rendered (⠿ character)
    expect(screen.getByText('⠿')).toBeInTheDocument()
  })

  it('renders breadcrumb on nested folder hover', async () => {
    const folders = [
      makeFolder({ id: 'f1', name: 'Parent', sort_order: 0 }),
      makeFolder({ id: 'f2', name: 'Child', parent_id: 'f1', sort_order: 0 })
    ]
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue(folders)

    const user = userEvent.setup()
    render(<ToolkitManager />)
    await waitFor(() => expect(screen.getByText('Parent')).toBeInTheDocument())

    // Expand parent folder to see child
    await user.click(screen.getByText('Parent'))
    await waitFor(() => expect(screen.getByText('Child')).toBeInTheDocument())

    // Hover the child folder to reveal breadcrumb
    await user.hover(screen.getByText('Child'))
    await waitFor(() => expect(screen.getByText('/ Root')).toBeInTheDocument())
  })

  it('calls moveToolFolderToFolder when breadcrumb root is clicked', async () => {
    // Test the FolderRow breadcrumb directly
    const { FolderRow } = await import('../FolderRow')
    const onMoveToParent = vi.fn()
    const ancestors = [makeFolder({ id: 'f1', name: 'Parent' })]

    render(
      <FolderRow
        folder={makeFolder({ id: 'f2', name: 'Child', parent_id: 'f1' })}
        depth={1}
        toolCount={0}
        expanded={false}
        onToggle={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onAddTool={vi.fn()}
        onAddSubFolder={vi.fn()}
        onDragStart={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onDragLeave={vi.fn()}
        ancestors={ancestors}
        onMoveToParent={onMoveToParent}
      >
        <div />
      </FolderRow>
    )

    // Hover the folder row to show breadcrumb
    // The outer div (with onMouseEnter) wraps the row div (which contains 'Child' text)
    // Navigate up: Child text → span → row div → outer div
    const folderText = screen.getByText('Child')
    const rowDiv = folderText.closest('.group')!
    const outerDiv = rowDiv.parentElement!
    fireEvent.mouseEnter(outerDiv)

    // Breadcrumb should be visible
    const rootCrumb = screen.getByText('/ Root')
    expect(rootCrumb).toBeInTheDocument()

    // Click root breadcrumb
    fireEvent.click(rootCrumb)
    expect(onMoveToParent).toHaveBeenCalledWith(null)
  })
})
