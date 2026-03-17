import { useState, useRef, useEffect, useMemo } from 'react'
import type { Investigation } from '@shared/ipc-types'
import { formatDate } from '@shared/format-date'
import { ConfirmDialog } from './ConfirmDialog'

// ── Helpers ──────────────────────────────────────────────────────

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

function formatDateShort(isoString: string): string {
  try {
    const normalized = isoString.endsWith('Z') ? isoString : isoString + 'Z'
    return new Date(normalized).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return isoString
  }
}

// ── Types ────────────────────────────────────────────────────────

type SortKey = 'name' | 'status' | 'created' | 'updated'
type SortDir = 'asc' | 'desc'

interface Props {
  investigations: Investigation[]
  onSetActive: (id: string) => Promise<void>
  onDeactivate: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

// ── Overflow menu ────────────────────────────────────────────────

function OverflowMenu({ onDelete }: { onDelete: () => void }) {
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
        <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 py-1">
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

// ── Sort indicator ───────────────────────────────────────────────

function SortIndicator({ sortKey, currentKey, dir }: { sortKey: SortKey; currentKey: SortKey; dir: SortDir }) {
  const active = sortKey === currentKey
  return (
    <span className={`text-[10px] ml-1 ${active ? 'text-indigo-400' : 'text-gray-600'}`}>
      {active ? (dir === 'asc' ? '\u25B2' : '\u25BC') : '\u25B2\u25BC'}
    </span>
  )
}

// ── Main component ───────────────────────────────────────────────

export function InvestigationList({ investigations, onSetActive, onDeactivate, onDelete }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('created')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [confirmDeactivate, setConfirmDeactivate] = useState<Investigation | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Investigation | null>(null)

  const active = useMemo(() => investigations.filter((i) => i.is_active === 1), [investigations])
  const inactive = useMemo(() => investigations.filter((i) => i.is_active === 0), [investigations])

  // Filter by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return inactive
    return inactive.filter((inv) => inv.name.toLowerCase().includes(q))
  }, [inactive, search])

  // Sort
  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'status':
          cmp = a.is_active - b.is_active
          break
        case 'created':
          cmp = a.created_at.localeCompare(b.created_at)
          break
        case 'updated': {
          const aTime = a.last_entry_at ?? a.created_at
          const bTime = b.last_entry_at ?? b.created_at
          cmp = aTime.localeCompare(bTime)
          break
        }
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [filtered, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
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
    if (inv.is_active === 1) {
      setConfirmDeactivate(inv)
    } else {
      await withLoading(inv.id, () => onSetActive(inv.id))
    }
  }

  function handleDeleteRequest(inv: Investigation) {
    setConfirmDelete(inv)
  }

  if (investigations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        No investigations yet. Create one to get started.
      </div>
    )
  }

  const thClass = 'px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none text-left'

  return (
    <div className="flex flex-col gap-6">
      {/* ── Active investigations ── */}
      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h2 className="text-green-400 text-xs font-semibold uppercase tracking-wider">Active Investigations</h2>
            <span className="text-gray-600 text-xs">({active.length})</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-green-950/20 border border-green-900/40 rounded-xl">
            {active.map((inv) => {
              const isLoading = loadingId === inv.id
              const entryLabel = inv.entry_count === 1 ? '1 entry' : `${inv.entry_count} entries`
              const lastEntryLabel = inv.last_entry_at
                ? `Last entry ${formatRelativeTime(inv.last_entry_at)}`
                : 'No entries'

              return (
                <div
                  key={inv.id}
                  onClick={() => window.electronAPI.openDetails(inv.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border cursor-pointer
                    bg-indigo-950/50 border-indigo-700/60 hover:border-indigo-600/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-100 font-medium text-sm truncate">{inv.name}</span>
                        <span className="text-xs bg-indigo-600 text-indigo-100 px-1.5 py-0.5 rounded font-medium flex-shrink-0">active</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>Created {formatDate(inv.created_at)}</span>
                        <span className="text-gray-700">&middot;</span>
                        <span>{entryLabel}</span>
                        <span className="text-gray-700">&middot;</span>
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
                      {isLoading ? '…' : 'Deactivate'}
                    </button>
                    <OverflowMenu onDelete={() => handleDeleteRequest(inv)} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── All investigations table ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
            All Investigations
            {inactive.length > 0 && (
              <span className="ml-2 text-gray-600 font-normal normal-case">({inactive.length})</span>
            )}
          </h2>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="bg-gray-800 text-gray-100 placeholder-gray-600 rounded-lg pl-8 pr-3 py-1.5
                border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                outline-none text-xs w-52 transition-colors"
            />
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
            {search ? 'No investigations match your search.' : 'No past investigations.'}
          </div>
        ) : (
          <div className="border border-gray-700/50 rounded-lg overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/80">
                  <th className={thClass} onClick={() => handleSort('name')}>
                    <span className="inline-flex items-center">Name<SortIndicator sortKey="name" currentKey={sortKey} dir={sortDir} /></span>
                  </th>
                  <th className={thClass} onClick={() => handleSort('created')}>
                    <span className="inline-flex items-center">Created<SortIndicator sortKey="created" currentKey={sortKey} dir={sortDir} /></span>
                  </th>
                  <th className={thClass} onClick={() => handleSort('updated')}>
                    <span className="inline-flex items-center">Updated<SortIndicator sortKey="updated" currentKey={sortKey} dir={sortDir} /></span>
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Entries</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {sorted.map((inv) => {
                  const isLoading = loadingId === inv.id
                  const updatedLabel = inv.last_entry_at
                    ? formatRelativeTime(inv.last_entry_at)
                    : '—'

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => window.electronAPI.openDetails(inv.id)}
                      className="hover:bg-gray-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-gray-300 font-medium">{inv.name}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDateShort(inv.created_at)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{updatedLabel}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs text-right">{inv.entry_count}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleToggleActive(e, inv)}
                            disabled={isLoading}
                            className="px-2 py-1 text-xs font-medium rounded-md transition-colors
                              bg-gray-700 hover:bg-gray-600 text-gray-300
                              disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isLoading ? '…' : 'Activate'}
                          </button>
                          <OverflowMenu onDelete={() => handleDeleteRequest(inv)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Deactivation confirmation dialog ── */}
      {confirmDeactivate && (
        <ConfirmDialog
          title="Deactivate investigation?"
          message={`Are you sure you want to deactivate "${confirmDeactivate.name}"? It will be moved to the table below and you'll need to find it again to reactivate.`}
          confirmLabel="Deactivate"
          confirmVariant="warning"
          onCancel={() => setConfirmDeactivate(null)}
          onConfirm={async () => {
            const inv = confirmDeactivate
            setConfirmDeactivate(null)
            await withLoading(inv.id, () => onDeactivate(inv.id))
          }}
        />
      )}

      {/* ── Deletion confirmation dialog ── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete investigation?"
          message={`This will permanently delete "${confirmDelete.name}" and all its journal entries. This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const inv = confirmDelete
            setConfirmDelete(null)
            await withLoading(inv.id, () => onDelete(inv.id))
          }}
        />
      )}
    </div>
  )
}
