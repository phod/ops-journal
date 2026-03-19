import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BulkToolForm } from '../BulkToolForm'

describe('BulkToolForm', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    onClose.mockReset()
    window.electronAPI.createToolsBulk = vi.fn().mockResolvedValue([])
  })

  it('renders modal with title', () => {
    render(<BulkToolForm onClose={onClose} />)
    expect(screen.getByText('Bulk Create Tools')).toBeInTheDocument()
  })

  it('starts with one empty row', () => {
    render(<BulkToolForm onClose={onClose} />)
    const nameInputs = screen.getAllByPlaceholderText('Name')
    expect(nameInputs).toHaveLength(1)
  })

  it('adds a row when Add another is clicked', async () => {
    const user = userEvent.setup()
    render(<BulkToolForm onClose={onClose} />)
    await user.click(screen.getByText('+ Add another'))
    const nameInputs = screen.getAllByPlaceholderText('Name')
    expect(nameInputs).toHaveLength(2)
  })

  it('removes a row when remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<BulkToolForm onClose={onClose} />)
    await user.click(screen.getByText('+ Add another'))
    expect(screen.getAllByPlaceholderText('Name')).toHaveLength(2)

    const removeButtons = screen.getAllByTitle('Remove row')
    await user.click(removeButtons[0])
    expect(screen.getAllByPlaceholderText('Name')).toHaveLength(1)
  })

  it('does not remove the last row', async () => {
    const user = userEvent.setup()
    render(<BulkToolForm onClose={onClose} />)
    const removeButton = screen.getByTitle('Remove row')
    expect(removeButton).toBeDisabled()
  })

  it('shows create button disabled when no valid rows', () => {
    render(<BulkToolForm onClose={onClose} />)
    const createBtn = screen.getByRole('button', { name: /Create 0 Tools/i })
    expect(createBtn).toBeDisabled()
  })

  it('shows valid row count in create button', async () => {
    const user = userEvent.setup()
    render(<BulkToolForm onClose={onClose} />)

    const nameInput = screen.getByPlaceholderText('Name')
    const valueInput = screen.getByPlaceholderText('https://...')

    await user.type(nameInput, 'Grafana')
    await user.type(valueInput, 'https://grafana.com')

    expect(screen.getByRole('button', { name: /Create 1 Tool$/i })).toBeEnabled()
  })

  it('submits with correctly merged and deduped tags', async () => {
    const user = userEvent.setup()
    render(<BulkToolForm onClose={onClose} />)

    // Set shared tags
    await user.type(screen.getByPlaceholderText('e.g. runbook, production'), 'shared, prod')

    // Fill in row
    await user.type(screen.getByPlaceholderText('Name'), 'My Tool')
    await user.type(screen.getByPlaceholderText('https://...'), 'https://example.com')

    // Toggle per-row tags and add one that overlaps
    await user.click(screen.getByTitle('Per-row tags'))
    await user.type(screen.getByPlaceholderText('+ extra tags for this row'), 'prod, extra')

    // Submit
    await user.click(screen.getByRole('button', { name: /Create 1 Tool$/i }))

    expect(window.electronAPI.createToolsBulk).toHaveBeenCalledWith([
      {
        name: 'My Tool',
        toolType: 'link',
        value: 'https://example.com',
        tags: ['shared', 'prod', 'extra']
      }
    ])
    expect(onClose).toHaveBeenCalled()
  })

  it('toggles per-row tag input visibility', async () => {
    const user = userEvent.setup()
    render(<BulkToolForm onClose={onClose} />)

    expect(screen.queryByPlaceholderText('+ extra tags for this row')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Per-row tags'))
    expect(screen.getByPlaceholderText('+ extra tags for this row')).toBeInTheDocument()
    await user.click(screen.getByTitle('Per-row tags'))
    expect(screen.queryByPlaceholderText('+ extra tags for this row')).not.toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<BulkToolForm onClose={onClose} />)
    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
