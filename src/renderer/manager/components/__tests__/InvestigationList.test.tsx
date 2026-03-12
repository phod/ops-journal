import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { InvestigationList } from '../InvestigationList'
import type { Investigation } from '../../../../../shared/ipc-types'

function makeInvestigation(overrides: Partial<Investigation> = {}): Investigation {
  return {
    id: 'inv-1',
    name: 'Test Investigation',
    is_active: 0,
    created_at: '2024-01-01 10:00:00',
    ...overrides
  }
}

describe('InvestigationList', () => {
  let onSetActive: ReturnType<typeof vi.fn>
  let onDelete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSetActive = vi.fn().mockResolvedValue(undefined)
    onDelete = vi.fn().mockResolvedValue(undefined)
    window.confirm = vi.fn().mockReturnValue(true)
  })

  it('shows empty state when no investigations exist', () => {
    render(<InvestigationList investigations={[]} onSetActive={onSetActive} onDelete={onDelete} />)
    expect(screen.getByText(/no investigations yet/i)).toBeInTheDocument()
  })

  it('renders each investigation name', () => {
    const investigations = [
      makeInvestigation({ id: '1', name: 'Alpha' }),
      makeInvestigation({ id: '2', name: 'Beta' })
    ]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDelete={onDelete} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('shows "active" badge for the active investigation', () => {
    const investigations = [
      makeInvestigation({ id: '1', name: 'Active One', is_active: 1 }),
      makeInvestigation({ id: '2', name: 'Inactive', is_active: 0 })
    ]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDelete={onDelete} />)
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('disables "Set Active" for the already-active investigation', () => {
    const investigations = [makeInvestigation({ is_active: 1 })]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDelete={onDelete} />)
    expect(screen.getByRole('button', { name: /set active/i })).toBeDisabled()
  })

  it('calls onSetActive when "Set Active" is clicked', async () => {
    const user = userEvent.setup()
    const investigations = [makeInvestigation({ id: 'inv-1', is_active: 0 })]
    render(<InvestigationList investigations={investigations} onSetActive={onSetActive} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: /set active/i }))
    await waitFor(() => expect(onSetActive).toHaveBeenCalledWith('inv-1'))
  })

  it('prompts for confirmation before deleting', async () => {
    const user = userEvent.setup()
    render(
      <InvestigationList
        investigations={[makeInvestigation({ name: 'Doomed' })]}
        onSetActive={onSetActive}
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(window.confirm).toHaveBeenCalled()
  })

  it('calls onDelete when deletion is confirmed', async () => {
    const user = userEvent.setup()
    ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true)

    render(
      <InvestigationList
        investigations={[makeInvestigation({ id: 'inv-1' })]}
        onSetActive={onSetActive}
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('inv-1'))
  })

  it('does not call onDelete when deletion is cancelled', async () => {
    const user = userEvent.setup()
    ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false)

    render(
      <InvestigationList
        investigations={[makeInvestigation()]}
        onSetActive={onSetActive}
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
  })
})
