import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import App from '../App'
import type { Tool, ToolFolder } from '@shared/ipc-types'

// scrollIntoView is not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn()

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: 'tool-1',
    name: 'Grafana Dashboard',
    tool_type: 'link',
    value: 'https://grafana.example.com',
    tags: ['monitoring'],
    sort_order: 0,
    folder_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

const sampleTools: Tool[] = [
  makeTool({ id: '1', name: 'Grafana', value: 'https://grafana.example.com', tags: ['monitoring'] }),
  makeTool({ id: '2', name: 'kubectl pods', tool_type: 'string', value: 'kubectl get pods', tags: ['k8s'] }),
  makeTool({ id: '3', name: 'PagerDuty', value: 'https://pagerduty.example.com', tags: ['alerting'] }),
  makeTool({ id: '4', name: 'Selenium Suite', value: 'https://selenium.example.com', tags: ['website', 'test'] })
]

function makeFolder(overrides: Partial<ToolFolder> = {}): ToolFolder {
  return {
    id: 'folder-1',
    name: 'Monitoring',
    parent_id: null,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

describe('Toolkit App', () => {
  beforeEach(() => {
    window.electronAPI.listTools = vi.fn().mockResolvedValue(sampleTools)
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue([])
    window.electronAPI.onToolsChanged = vi.fn().mockReturnValue(() => {})
    window.electronAPI.onToolFoldersChanged = vi.fn().mockReturnValue(() => {})
    window.electronAPI.executeTool = vi.fn().mockResolvedValue(undefined)
    window.electronAPI.hideToolkitOverlay = vi.fn().mockResolvedValue(undefined)
  })

  it('loads and displays tools', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())
    expect(screen.getByText('kubectl pods')).toBeInTheDocument()
    expect(screen.getByText('PagerDuty')).toBeInTheDocument()
  })

  it('shows tool count', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('4 tools')).toBeInTheDocument())
  })

  it('shows empty state when no tools exist', async () => {
    window.electronAPI.listTools = vi.fn().mockResolvedValue([])
    render(<App />)
    await waitFor(() => expect(screen.getByText(/no tools yet/i)).toBeInTheDocument())
  })

  it('filters tools by name', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search tools...'), 'graf')
    // highlightMatch splits "Grafana" into fragments, so use a substring match
    expect(screen.getByText(/raf/)).toBeInTheDocument()
    expect(screen.queryByText('kubectl pods')).not.toBeInTheDocument()
    expect(screen.queryByText('PagerDuty')).not.toBeInTheDocument()
  })

  it('filters tools by tag', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search tools...'), 'k8s')
    expect(screen.getByText('kubectl pods')).toBeInTheDocument()
    expect(screen.queryByText('Grafana')).not.toBeInTheDocument()
  })

  it('shows "No matching tools" when filter has no results', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search tools...'), 'nonexistent')
    expect(screen.getByText('No matching tools')).toBeInTheDocument()
  })

  it('updates tool count when filtering', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('4 tools')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search tools...'), 'graf')
    expect(screen.getByText('1 tool')).toBeInTheDocument()
  })

  it('executes a tool on Enter', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

    await user.keyboard('{Enter}')
    expect(window.electronAPI.executeTool).toHaveBeenCalledWith('1')
  })

  it('hides overlay on Escape', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

    await user.keyboard('{Escape}')
    expect(window.electronAPI.hideToolkitOverlay).toHaveBeenCalled()
  })

  it('hides overlay after executing a link tool', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

    await user.keyboard('{Enter}')
    await waitFor(() => expect(window.electronAPI.hideToolkitOverlay).toHaveBeenCalled())
  })

  it('subscribes to tools:changed events', () => {
    render(<App />)
    expect(window.electronAPI.onToolsChanged).toHaveBeenCalled()
  })

  it('multi-term search matches tool with both tags', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Selenium Suite')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search tools...'), 'website test')
    expect(screen.getByText('Selenium Suite')).toBeInTheDocument()
    expect(screen.queryByText('Grafana')).not.toBeInTheDocument()
  })

  it('multi-term search matches across tag and name', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search tools...'), 'monitoring graf')
    expect(screen.getByText(/raf/)).toBeInTheDocument()
    expect(screen.queryByText('PagerDuty')).not.toBeInTheDocument()
  })

  it('partial multi-term match does not return the tool', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Grafana')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search tools...'), 'monitoring alert')
    expect(screen.getByText('No matching tools')).toBeInTheDocument()
  })

  it('renders keyboard shortcut hints', async () => {
    render(<App />)
    expect(screen.getByText('navigate')).toBeInTheDocument()
    expect(screen.getByText('execute')).toBeInTheDocument()
    expect(screen.getByText('close')).toBeInTheDocument()
  })

  it('renders folder headers when folders exist', async () => {
    const folders = [makeFolder({ id: 'f1', name: 'Monitoring' })]
    const toolsInFolder = [
      makeTool({ id: '1', name: 'Grafana', folder_id: 'f1' })
    ]
    window.electronAPI.listTools = vi.fn().mockResolvedValue(toolsInFolder)
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue(folders)

    render(<App />)
    await waitFor(() => expect(screen.getByText('Monitoring')).toBeInTheDocument())
    expect(screen.getByText('Grafana')).toBeInTheDocument()
  })

  it('shows fold/unfold hint when folders exist', async () => {
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue([
      makeFolder({ id: 'f1', name: 'Scripts' })
    ])
    render(<App />)
    await waitFor(() => expect(screen.getByText('fold/unfold')).toBeInTheDocument())
  })

  it('collapses folder on ArrowLeft', async () => {
    const folders = [makeFolder({ id: 'f1', name: 'Scripts' })]
    const toolsInFolder = [
      makeTool({ id: '1', name: 'Deploy Script', folder_id: 'f1' })
    ]
    window.electronAPI.listTools = vi.fn().mockResolvedValue(toolsInFolder)
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue(folders)

    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Scripts')).toBeInTheDocument())

    // Folder is expanded by default, tool visible
    expect(screen.getByText('Deploy Script')).toBeInTheDocument()

    // ArrowLeft on folder should collapse it
    await user.keyboard('{ArrowLeft}')
    expect(screen.queryByText('Deploy Script')).not.toBeInTheDocument()
  })

  it('auto-expands folders with search matches', async () => {
    const folders = [makeFolder({ id: 'f1', name: 'Scripts' })]
    const toolsInFolder = [
      makeTool({ id: '1', name: 'Deploy Script', folder_id: 'f1' }),
      makeTool({ id: '2', name: 'Root Tool', folder_id: null })
    ]
    window.electronAPI.listTools = vi.fn().mockResolvedValue(toolsInFolder)
    window.electronAPI.listToolFolders = vi.fn().mockResolvedValue(folders)

    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Deploy Script')).toBeInTheDocument())

    // Collapse folder first
    await user.keyboard('{ArrowLeft}')
    expect(screen.queryByText('Deploy Script')).not.toBeInTheDocument()

    // Search should auto-expand the folder
    await user.type(screen.getByPlaceholderText('Search tools...'), 'deploy')
    expect(screen.getByText(/eploy/)).toBeInTheDocument()
    expect(screen.queryByText('Root Tool')).not.toBeInTheDocument()
  })
})
