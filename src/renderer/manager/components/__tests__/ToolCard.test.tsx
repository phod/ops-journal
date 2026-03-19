import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { ToolCard } from '../ToolCard'
import type { Tool } from '@shared/ipc-types'

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: 'tool-1',
    name: 'Grafana Dashboard',
    tool_type: 'link',
    value: 'https://grafana.example.com',
    tags: [],
    sort_order: 0,
    folder_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

describe('ToolCard', () => {
  it('renders the tool name', () => {
    render(<ToolCard tool={makeTool()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Grafana Dashboard')).toBeInTheDocument()
  })

  it('renders the tool value', () => {
    render(<ToolCard tool={makeTool()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('https://grafana.example.com')).toBeInTheDocument()
  })

  it('renders the type badge for link tools', () => {
    render(<ToolCard tool={makeTool({ tool_type: 'link' })} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('link')).toBeInTheDocument()
  })

  it('renders the type badge for string tools', () => {
    render(<ToolCard tool={makeTool({ tool_type: 'string' })} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('string')).toBeInTheDocument()
  })

  it('renders tags when present', () => {
    render(<ToolCard tool={makeTool({ tags: ['monitoring', 'prod'] })} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('monitoring')).toBeInTheDocument()
    expect(screen.getByText('prod')).toBeInTheDocument()
  })

  it('does not render tags section when tags are empty', () => {
    render(<ToolCard tool={makeTool({ tags: [] })} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('monitoring')).not.toBeInTheDocument()
  })

  it('shows overflow menu with Edit and Delete on click', async () => {
    const user = userEvent.setup()
    render(<ToolCard tool={makeTool()} onEdit={vi.fn()} onDelete={vi.fn()} />)

    await user.click(screen.getByText('···'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onEdit when Edit is clicked', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<ToolCard tool={makeTool()} onEdit={onEdit} onDelete={vi.fn()} />)

    await user.click(screen.getByText('···'))
    await user.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('shows confirm dialog when Delete is clicked', async () => {
    const user = userEvent.setup()
    render(<ToolCard tool={makeTool()} onEdit={vi.fn()} onDelete={vi.fn()} />)

    await user.click(screen.getByText('···'))
    await user.click(screen.getByText('Delete'))
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument()
  })

  it('calls onDelete when deletion is confirmed', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<ToolCard tool={makeTool()} onEdit={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByText('···'))
    await user.click(screen.getByText('Delete'))
    // Click the confirm button in the dialog
    const confirmBtns = screen.getAllByText('Delete')
    await user.click(confirmBtns[confirmBtns.length - 1])
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
