import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { InvestigationList } from '../InvestigationList'
import type { Investigation } from '@shared/ipc-types'

function makeInvestigation(overrides: Partial<Investigation> = {}): Investigation {
  return {
    id: 'inv-1',
    name: 'Test Investigation',
    is_active: 0,
    created_at: '2024-01-01 10:00:00',
    entry_count: 0,
    last_entry_at: null,
    ...overrides
  }
}

describe('InvestigationList', () => {
  let onSetActive: ReturnType<typeof vi.fn>
  let onDeactivate: ReturnType<typeof vi.fn>
  let onDelete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSetActive = vi.fn().mockResolvedValue(undefined)
    onDeactivate = vi.fn().mockResolvedValue(undefined)
    onDelete = vi.fn().mockResolvedValue(undefined)
  })

  it('shows empty state when no investigations exist', () => {
    render(<InvestigationList investigations={[]} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)
    expect(screen.getByText(/no investigations yet/i)).toBeInTheDocument()
  })

  it('renders each investigation name', () => {
    const investigations = [
      makeInvestigation({ id: '1', name: 'Alpha' }),
      makeInvestigation({ id: '2', name: 'Beta' })
    ]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('shows active investigations in a dedicated section', () => {
    const investigations = [
      makeInvestigation({ id: '1', name: 'Active One', is_active: 1 }),
      makeInvestigation({ id: '2', name: 'Inactive One', is_active: 0 })
    ]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)
    expect(screen.getByText(/active investigations/i)).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows "Deactivate" button for the active investigation', () => {
    const investigations = [makeInvestigation({ is_active: 1 })]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)
    expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument()
  })

  it('calls onSetActive when "Activate" is clicked for inactive investigation', async () => {
    const user = userEvent.setup()
    const investigations = [makeInvestigation({ id: 'inv-1', is_active: 0 })]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: /activate/i }))
    await waitFor(() => expect(onSetActive).toHaveBeenCalledWith('inv-1'))
  })

  it('shows confirmation dialog before deactivating an investigation', async () => {
    const user = userEvent.setup()
    const investigations = [makeInvestigation({ id: 'inv-1', name: 'My Active', is_active: 1 })]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: /deactivate/i }))

    // Confirmation dialog should appear
    expect(screen.getByText(/deactivate investigation/i)).toBeInTheDocument()
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
    expect(onDeactivate).not.toHaveBeenCalled()
  })

  it('calls onDeactivate when deactivation is confirmed', async () => {
    const user = userEvent.setup()
    const investigations = [makeInvestigation({ id: 'inv-1', is_active: 1 })]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: /deactivate/i }))
    // Click the confirm button in the dialog
    const dialog = screen.getByText(/deactivate investigation/i).closest('div[class*="fixed"]')!
    await user.click(within(dialog as HTMLElement).getAllByRole('button', { name: /deactivate/i })[0])
    await waitFor(() => expect(onDeactivate).toHaveBeenCalledWith('inv-1'))
  })

  it('does not call onDeactivate when deactivation is cancelled', async () => {
    const user = userEvent.setup()
    const investigations = [makeInvestigation({ id: 'inv-1', is_active: 1 })]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: /deactivate/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onDeactivate).not.toHaveBeenCalled()
  })

  it('shows confirmation dialog before deleting', async () => {
    const user = userEvent.setup()
    render(
      <InvestigationList
        investigations={[makeInvestigation({ name: 'Doomed' })]}
        onSetActive={onSetActive}
        onDeactivate={onDeactivate}
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByTitle('More options'))
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(screen.getByText(/delete investigation/i)).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('calls onDelete when deletion is confirmed', async () => {
    const user = userEvent.setup()
    render(
      <InvestigationList
        investigations={[makeInvestigation({ id: 'inv-1' })]}
        onSetActive={onSetActive}
        onDeactivate={onDeactivate}
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByTitle('More options'))
    await user.click(screen.getByRole('button', { name: /delete/i }))
    // Click delete in confirmation dialog
    const dialog = screen.getByText(/delete investigation/i).closest('div[class*="fixed"]')!
    await user.click(within(dialog as HTMLElement).getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('inv-1'))
  })

  it('does not call onDelete when deletion is cancelled', async () => {
    const user = userEvent.setup()
    render(
      <InvestigationList
        investigations={[makeInvestigation()]}
        onSetActive={onSetActive}
        onDeactivate={onDeactivate}
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByTitle('More options'))
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('filters investigations by search text', async () => {
    const user = userEvent.setup()
    const investigations = [
      makeInvestigation({ id: '1', name: 'Payment gateway' }),
      makeInvestigation({ id: '2', name: 'DNS issue' })
    ]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)

    await user.type(screen.getByPlaceholderText(/search/i), 'payment')
    expect(screen.getByText('Payment gateway')).toBeInTheDocument()
    expect(screen.queryByText('DNS issue')).not.toBeInTheDocument()
  })

  it('sorts investigations by name when clicking the Name header', async () => {
    const user = userEvent.setup()
    const investigations = [
      makeInvestigation({ id: '1', name: 'Charlie', created_at: '2024-01-03' }),
      makeInvestigation({ id: '2', name: 'Alpha', created_at: '2024-01-02' }),
      makeInvestigation({ id: '3', name: 'Bravo', created_at: '2024-01-01' })
    ]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDeactivate={onDeactivate} onDelete={onDelete} />)

    // Click Name header to sort desc (first click changes key to name, defaults to desc)
    await user.click(screen.getByText('Name'))
    const rows = screen.getAllByRole('row').slice(1) // skip header
    expect(within(rows[0]).getByText('Charlie')).toBeInTheDocument()

    // Click again for ascending
    await user.click(screen.getByText('Name'))
    const rowsAsc = screen.getAllByRole('row').slice(1)
    expect(within(rowsAsc[0]).getByText('Alpha')).toBeInTheDocument()
  })
})
