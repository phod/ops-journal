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

describe('CreateInvestigationForm', () => {
  let onCreated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onCreated = vi.fn()
    window.electronAPI.createInvestigation = vi.fn().mockResolvedValue(mockInvestigation)
    window.electronAPI.setActiveInvestigation = vi.fn().mockResolvedValue(mockInvestigation)
  })

  it('renders the name input and submit button', () => {
    render(<CreateInvestigationForm onCreated={onCreated} />)
    expect(screen.getByPlaceholderText(/investigation name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('disables the button when input is empty', () => {
    render(<CreateInvestigationForm onCreated={onCreated} />)
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled()
  })

  it('enables the button when input has text', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)
    await user.type(screen.getByPlaceholderText(/investigation name/i), 'My Investigation')
    expect(screen.getByRole('button', { name: /create/i })).not.toBeDisabled()
  })

  it('calls createInvestigation and setActiveInvestigation on submit', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)

    await user.type(screen.getByPlaceholderText(/investigation name/i), 'New Investigation')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(window.electronAPI.createInvestigation).toHaveBeenCalledWith('New Investigation')
      expect(window.electronAPI.setActiveInvestigation).toHaveBeenCalledWith('inv-1')
      expect(onCreated).toHaveBeenCalled()
    })
  })

  it('clears input after successful submission', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)

    const input = screen.getByPlaceholderText(/investigation name/i)
    await user.type(input, 'Cleared After Submit')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('shows an error message when creation fails', async () => {
    const user = userEvent.setup()
    window.electronAPI.createInvestigation = vi.fn().mockRejectedValue(new Error('DB error'))

    render(<CreateInvestigationForm onCreated={onCreated} />)

    await user.type(screen.getByPlaceholderText(/investigation name/i), 'Failing Investigation')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => expect(screen.getByText(/failed to create/i)).toBeInTheDocument())
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('does not submit whitespace-only names', async () => {
    const user = userEvent.setup()
    render(<CreateInvestigationForm onCreated={onCreated} />)

    await user.type(screen.getByPlaceholderText(/investigation name/i), '   ')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(window.electronAPI.createInvestigation).not.toHaveBeenCalled()
  })
})
