import { useState, useRef, useEffect } from 'react'
import type { Investigation } from '@shared/ipc-types'
import { formatDate } from '@shared/format-date'

interface OverflowMenuProps {
  onDelete: () => void
}

function OverflowMenu({ onDelete }: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
        title="More options"
      >
        ···
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 py-1">
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(isoString: string): string {
  try {
    const normalized = isoString.endsWith('Z') ? isoString : isoString + 'Z'
    const diff = Date.now() - new Date(normalized).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  } catch {
    return formatDate(isoString)
  }
}

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

  async function handleToggleActive(e: React.MouseEvent, inv: Investigation): Promise<void> {
    e.stopPropagation()
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
        const entryLabel = inv.entry_count === 1 ? '1 entry' : `${inv.entry_count} entries`
        const lastEntryLabel = inv.last_entry_at
          ? `Last entry ${formatRelativeTime(inv.last_entry_at)}`
          : 'No entries'

        return (
          <div
            key={inv.id}
            onClick={() => window.electronAPI.openDetails(inv.id)}
            className={`
              flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer
              ${isActive
                ? 'bg-indigo-950/50 border-indigo-700/60 hover:border-indigo-600/80'
                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600/50 hover:bg-gray-800/70'
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
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  <span>Created {formatDate(inv.created_at)}</span>
                  <span className="text-gray-700">·</span>
                  <span>{entryLabel}</span>
                  <span className="text-gray-700">·</span>
                  <span>{lastEntryLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={(e) => handleToggleActive(e, inv)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  bg-gray-700 hover:bg-gray-600 text-gray-200
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? '…' : isActive ? 'Deactivate' : 'Activate'}
              </button>
              <OverflowMenu onDelete={() => handleDelete(inv)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
