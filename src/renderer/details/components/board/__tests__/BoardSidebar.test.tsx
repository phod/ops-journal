import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { BoardSidebar } from '../BoardSidebar'
import type { JournalEntry } from '@shared/ipc-types'

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    investigation_id: 'inv-1',
    body: 'Test entry',
    image_paths: [],
    created_at: '2024-01-01 10:00:00',
    type: 'finding',
    ...overrides
  }
}

const defaultProps = {
  entries: [makeEntry()],
  onAddTextBox: vi.fn(),
  onAddImage: vi.fn(),
  onAddShape: vi.fn(),
  collapsed: false,
  onToggleCollapse: vi.fn()
}

describe('BoardSidebar', () => {
  it('renders filter tabs and entries when expanded', () => {
    render(<BoardSidebar {...defaultProps} />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Findings')).toBeInTheDocument()
    expect(screen.getByText('Test entry')).toBeInTheDocument()
    expect(screen.getByText('+ Text Box')).toBeInTheDocument()
  })

  it('renders only expand button when collapsed', () => {
    render(<BoardSidebar {...defaultProps} collapsed={true} />)
    expect(screen.queryByText('All')).not.toBeInTheDocument()
    expect(screen.queryByText('Test entry')).not.toBeInTheDocument()
    expect(screen.queryByText('+ Text Box')).not.toBeInTheDocument()
    expect(screen.getByTooltip('Show sidebar')).toBeInTheDocument()
  })

  it('calls onToggleCollapse when collapse button is clicked', () => {
    const onToggle = vi.fn()
    render(<BoardSidebar {...defaultProps} onToggleCollapse={onToggle} />)
    fireEvent.click(screen.getByTooltip('Hide sidebar'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('calls onToggleCollapse when expand button is clicked', () => {
    const onToggle = vi.fn()
    render(<BoardSidebar {...defaultProps} collapsed={true} onToggleCollapse={onToggle} />)
    fireEvent.click(screen.getByTooltip('Show sidebar'))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
