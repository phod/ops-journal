import { useState } from 'react'
import type { Investigation } from '@shared/ipc-types'
import { formatDate } from '@shared/format-date'

interface Props {
  investigations: Investigation[]
  onSetActive: (id: string) => Promise<void>
  onDeactivate: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function InvestigationList({ investigations, onSetActive, onDeactivate, onDelete }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (investigations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        No investigations yet. Create one above to get started.
      </div>
    )
  }

  async function withLoading(id: string, action: () => Promise<void>): Promise<void> {
    setLoadingId(id)
    try {
      await action()
    } finally {
      setLoadingId(null)
    }
  }

  async function handleToggleActive(inv: Investigation): Promise<void> {
    const action = inv.is_active === 1 ? onDeactivate : onSetActive
    await withLoading(inv.id, () => action(inv.id))
  }

  async function handleDelete(investigation: Investigation): Promise<void> {
    const confirmed = window.confirm(
      `Delete investigation "${investigation.name}"?\n\nThis will permanently delete the investigation and all its journal entries. This cannot be undone.`
    )
    if (!confirmed) return

    await withLoading(investigation.id, () => onDelete(investigation.id))
  }

  return (
    <div className="flex flex-col gap-2">
      {investigations.map((inv) => {
        const isActive = inv.is_active === 1
        const isLoading = loadingId === inv.id

        return (
          <div
            key={inv.id}
            className={`
              flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors
              ${isActive
                ? 'bg-indigo-950/50 border-indigo-700/60'
                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600/50'
              }
            `}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-400' : 'bg-gray-600'}`}
                title={isActive ? 'Active' : undefined}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-gray-100 font-medium text-sm truncate">
                    {inv.name}
                  </span>
                  {isActive && (
                    <span className="text-xs bg-indigo-600 text-indigo-100 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      active
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Created {formatDate(inv.created_at)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleToggleActive(inv)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  bg-gray-700 hover:bg-gray-600 text-gray-200
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? '…' : isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => window.electronAPI.openDetails(inv.id)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  bg-gray-700 hover:bg-gray-600 text-gray-200
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Details
              </button>
              <button
                onClick={() => handleDelete(inv)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  bg-gray-700 hover:bg-red-800 text-gray-400 hover:text-red-200
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
