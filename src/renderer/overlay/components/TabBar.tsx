import React, { useState, useRef, useLayoutEffect, useCallback } from 'react'
import type { Investigation } from '@shared/ipc-types'

interface Props {
  investigations: Investigation[]
  currentId: string | null
  onSelect: (id: string) => void
  onDeactivate: (id: string) => void
  onCreate: (name: string) => void
}

// Shared tab sizing classes (must match both visible tabs and measurement tabs)
const TAB_CLASS = 'flex items-center gap-1 px-2 py-1 rounded text-xs font-mono flex-shrink-0 max-w-[140px]'

export function TabBar({ investigations, currentId, onSelect, onDeactivate, onCreate }: Props) {
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(investigations.length)

  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  // Measure how many tabs fit by querying the hidden measurement div,
  // which always renders all tabs regardless of visibleCount.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const measureDiv = measureRef.current
      if (!measureDiv) return

      const containerWidth = container.offsetWidth
      // Reserve space for the "+" button (~32px) and "..." button (~40px) if needed
      const buttonReserve = 72
      const availableWidth = containerWidth - buttonReserve

      const tabElements = Array.from(measureDiv.querySelectorAll<HTMLElement>('[data-measure-tab]'))
      let usedWidth = 0
      let count = 0
      for (const el of tabElements) {
        usedWidth += el.offsetWidth + 4 // 4px gap
        if (usedWidth > availableWidth) break
        count++
      }
      setVisibleCount(count || 1)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [investigations.length])

  const handleNewKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation()
      if (e.key === 'Enter' && newName.trim()) {
        onCreate(newName.trim())
        setNewName('')
        setCreatingNew(false)
      } else if (e.key === 'Escape') {
        setNewName('')
        setCreatingNew(false)
      }
    },
    [newName, onCreate]
  )

  const startCreating = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCreatingNew(true)
    setTimeout(() => newInputRef.current?.focus(), 0)
  }

  const visibleTabs = investigations.slice(0, visibleCount)
  const overflowTabs = investigations.slice(visibleCount)
  const hasOverflow = overflowTabs.length > 0

  return (
    <>
      {/* Hidden measurement div — renders all tabs to get true widths */}
      <div
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none flex gap-1 px-2 py-1"
        aria-hidden="true"
        style={{ top: -9999, left: -9999 }}
      >
        {investigations.map((inv) => (
          <div key={inv.id} data-measure-tab className={TAB_CLASS}>
            <span className="truncate">{inv.name}</span>
            <span className="ml-0.5">×</span>
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        className="flex items-center gap-1 px-2 py-1 border-b border-gray-700/50 bg-gray-800/40"
      >
        {visibleTabs.map((inv) => {
          const isSelected = inv.id === currentId
          return (
            <div
              key={inv.id}
              className={`no-drag ${TAB_CLASS} cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-gray-700/60 text-gray-100'
                  : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
              }`}
              onClick={() => onSelect(inv.id)}
            >
              <span className="truncate">{inv.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeactivate(inv.id)
                }}
                className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-0.5"
                title="Close tab"
              >
                ×
              </button>
            </div>
          )
        })}

        {hasOverflow && (
          <div className="no-drag relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDropdownOpen((v) => !v)
              }}
              className="px-1.5 py-1 rounded text-xs text-gray-400 hover:bg-gray-700/40 hover:text-gray-200 transition-colors"
              title="More tabs"
            >
              •••
            </button>
            {dropdownOpen && (
              <div
                className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700/50 rounded shadow-lg z-50 min-w-[160px]"
                onMouseLeave={() => setDropdownOpen(false)}
              >
                {overflowTabs.map((inv) => (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-700/60 transition-colors ${
                      inv.id === currentId ? 'text-gray-100' : 'text-gray-400'
                    }`}
                    onClick={() => {
                      onSelect(inv.id)
                      setDropdownOpen(false)
                    }}
                  >
                    <span className="truncate">{inv.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeactivate(inv.id)
                        setDropdownOpen(false)
                      }}
                      className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                      title="Close tab"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {creatingNew ? (
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleNewKeyDown}
            onBlur={() => {
              setNewName('')
              setCreatingNew(false)
            }}
            placeholder="Investigation name…"
            className="no-drag flex-shrink-0 bg-gray-700/60 text-gray-100 text-xs font-mono px-2 py-1 rounded outline-none border border-indigo-500/50 w-40"
          />
        ) : (
          <button
            onClick={startCreating}
            className="no-drag flex-shrink-0 px-1.5 py-1 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 transition-colors"
            title="New investigation"
          >
            +
          </button>
        )}
      </div>
    </>
  )
}
