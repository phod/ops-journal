import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CreateInvestigationForm } from '../CreateInvestigationForm'

const mockInvestigation = {
  id: 'inv-1',
  name: 'New Investigation',
  is_active: 1,
  created_at: '2024-01-01 10:00:00'
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /new investigation/i }))
}

describe('CreateInvestigationForm', () => {
  let onCreated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onCreated = vi.fn()
    window.electronAPI.createInvestigation = vi.fn().mockResolvedValue(mockInvestigation)
    window.electronAPI.setActiveInvestigation = vi.fn().mockResolvedValue(mockInvestigation)
  })

  it('renders a trigger button that opens the dialog', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)
    expect(screen.getByRole('button', { name: /new investigation/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/investigation name/i)).not.toBeInTheDocument()

    await openDialog(user)
    expect(screen.getByPlaceholderText(/investigation name/i)).toBeInTheDocument()
  })

  it('disables the submit button when input is empty', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)
    await openDialog(user)
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled()
  })

  it('enables the submit button when input has text', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)
    await openDialog(user)
    await user.type(screen.getByPlaceholderText(/investigation name/i), 'My Investigation')
    expect(screen.getByRole('button', { name: /create/i })).not.toBeDisabled()
  })

  it('calls createInvestigation and setActiveInvestigation on submit', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)
    await openDialog(user)

    await user.type(screen.getByPlaceholderText(/investigation name/i), 'New Investigation')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(window.electronAPI.createInvestigation).toHaveBeenCalledWith('New Investigation')
      expect(window.electronAPI.setActiveInvestigation).toHaveBeenCalledWith('inv-1')
      expect(onCreated).toHaveBeenCalled()
    })
  })

  it('closes the dialog after successful submission', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)
    await openDialog(user)

    await user.type(screen.getByPlaceholderText(/investigation name/i), 'Cleared After Submit')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => expect(screen.queryByPlaceholderText(/investigation name/i)).not.toBeInTheDocument())
  })

  it('shows an error message when creation fails', async () => {
    const user = userEvent.setup()
    window.electronAPI.createInvestigation = vi.fn().mockRejectedValue(new Error('DB error'))

    render(<CreateInvestigationForm onCreated={onCreated} />)
    await openDialog(user)

    await user.type(screen.getByPlaceholderText(/investigation name/i), 'Failing Investigation')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => expect(screen.getByText(/failed to create/i)).toBeInTheDocument())
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('does not submit whitespace-only names', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)
    await openDialog(user)

    await user.type(screen.getByPlaceholderText(/investigation name/i), '   ')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(window.electronAPI.createInvestigation).not.toHaveBeenCalled()
  })

  it('closes the dialog when cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)
    await openDialog(user)

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/investigation name/i)).not.toBeInTheDocument()
  })
})
