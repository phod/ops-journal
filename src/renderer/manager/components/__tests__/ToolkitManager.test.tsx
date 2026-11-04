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

  it('calls duplicateTool when Duplicate is chosen from a tool menu', async () => {
    const tools = [makeTool({ id: 'tool-1', name: 'Prod dashboard' })]
    window.electronAPI.listTools = vi.fn().mockResolvedValue(tools)
    window.electronAPI.duplicateTool = vi.fn().mockResolvedValue(makeTool({ id: 'tool-2', name: 'Prod dashboard (2)' }))
    const user = userEvent.setup()
    render(<ToolkitManager />)

    await waitFor(() => expect(screen.getByText('Prod dashboard')).toBeInTheDocument())
    await user.click(screen.getByText('···'))
    await user.click(screen.getByText('Duplicate'))
    expect(window.electronAPI.duplicateTool).toHaveBeenCalledWith('tool-1')
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

  it('renders folder rows', async () => {
    const folders = [makeFolder({ id: 'f1', name: 'Scripts' })]
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue(folders)

    render(<ToolkitManager />)
    await waitFor(() => expect(screen.getByText('Scripts')).toBeInTheDocument())
  })

  describe('search', () => {
    const tools = [
      makeTool({ id: '1', name: 'Grafana', tags: ['monitoring', 'observability'] }),
      makeTool({ id: '2', name: 'kubectl pods', tags: ['kubernetes'], sort_order: 1 }),
      makeTool({ id: '3', name: 'PagerDuty', tags: ['alerting'], sort_order: 2 })
    ]

    beforeEach(() => {
      window.electronAPI.listTools = vi.fn().mockResolvedValue(tools)
    })

    it('renders the search input', async () => {
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByPlaceholderText('Search tools…')).toBeInTheDocument())
    })

    it('filters tools by name', async () => {
      const user = userEvent.setup()
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('Search tools…'), 'graf')

      expect(screen.getByText('Grafana')).toBeInTheDocument()
      expect(screen.queryByText('kubectl pods')).not.toBeInTheDocument()
      expect(screen.queryByText('PagerDuty')).not.toBeInTheDocument()
    })

    it('filters tools by tag', async () => {
      const user = userEvent.setup()
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('Search tools…'), 'monitor')

      expect(screen.getByText('Grafana')).toBeInTheDocument()
      expect(screen.queryByText('kubectl pods')).not.toBeInTheDocument()
    })

    it('shows match count badge', async () => {
      const user = userEvent.setup()
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('Search tools…'), 'graf')

      expect(screen.getByText('1 match')).toBeInTheDocument()
    })

    it('hides empty folders when no children match', async () => {
      const folders = [makeFolder({ id: 'f1', name: 'Empty Folder' })]
      window.electronAPI.listToolFolders = vi.fn().mockResolvedValue(folders)

      const user = userEvent.setup()
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())
      expect(screen.getByText('Empty Folder')).toBeInTheDocument()

      await user.type(screen.getByPlaceholderText('Search tools…'), 'graf')

      expect(screen.getByText('Grafana')).toBeInTheDocument()
      expect(screen.queryByText('Empty Folder')).not.toBeInTheDocument()
    })

    it('keeps ancestor folders visible for nested matches', async () => {
      const folders = [
        makeFolder({ id: 'f-parent', name: 'Parent Folder' }),
        makeFolder({ id: 'f-child', name: 'Child Folder', parent_id: 'f-parent', sort_order: 1 })
      ]
      const nestedTools = [
        makeTool({ id: '10', name: 'Nested Tool', folder_id: 'f-child', tags: ['special'] })
      ]
      window.electronAPI.listToolFolders = vi.fn().mockResolvedValue(folders)
      window.electronAPI.listTools = vi.fn().mockResolvedValue(nestedTools)

      const user = userEvent.setup()
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByText('Parent Folder')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('Search tools…'), 'nested')

      expect(screen.getByText('Nested Tool')).toBeInTheDocument()
      expect(screen.getByText('Parent Folder')).toBeInTheDocument()
      expect(screen.getByText('Child Folder')).toBeInTheDocument()
    })

    it('clears search and shows all tools when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('Search tools…'), 'graf')
      expect(screen.queryByText('kubectl pods')).not.toBeInTheDocument()

      await user.click(screen.getByText('✕'))

      expect(screen.getByText('Grafana')).toBeInTheDocument()
      expect(screen.getByText('kubectl pods')).toBeInTheDocument()
      expect(screen.getByText('PagerDuty')).toBeInTheDocument()
    })

    it('shows no-match message for zero results', async () => {
      const user = userEvent.setup()
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('Search tools…'), 'zzzznotfound')

      expect(screen.getByText('No tools match your search.')).toBeInTheDocument()
    })

    it('matches case-insensitively', async () => {
      const user = userEvent.setup()
      render(<ToolkitManager />)
      await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('Search tools…'), 'GRAFANA')

      expect(screen.getByText('Grafana')).toBeInTheDocument()
    })
  })

})
