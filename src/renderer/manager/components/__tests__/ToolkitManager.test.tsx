import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ToolkitManager } from '../ToolkitManager'
import type { Tool } from '@shared/ipc-types'

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: 'tool-1',
    name: 'Grafana',
    tool_type: 'link',
    value: 'https://grafana.example.com',
    tags: ['monitoring'],
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

describe('ToolkitManager', () => {
  beforeEach(() => {
    window.electronAPI.listTools = vi.fn().mockResolvedValue([])
    window.electronAPI.onToolsChanged = vi.fn().mockReturnValue(() => {})
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
})
