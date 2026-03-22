import React, { useState, useRef, useLayoutEffect, useCallback } from 'react'
import type { Investigation } from '@shared/ipc-types'

interface Props {
  investigations: Investigation[]
  currentId: string | null
  onSelect: (id: string) => void
  onDeactivate: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onReorder: (orderedIds: string[]) => void
}

// Shared tab sizing classes (must match both visible tabs and measurement tabs)
const TAB_CLASS = 'flex items-center gap-1 px-2 py-1 rounded text-xs font-mono flex-shrink-0 max-w-[140px]'

export function TabBar({ investigations, currentId, onSelect, onDeactivate, onCreate, onRename, onReorder }: Props) {
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(investigations.length)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // Drag state tracked via refs (synchronous, avoids stale closures) + render state for visuals
  const dragIndexRef = useRef<number | null>(null)
  const dropSlotRef = useRef<number | null>(null)
  const [dragVisual, setDragVisual] = useState<{ dragIndex: number; dropSlot: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

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

  const startRenaming = useCallback((inv: Investigation) => {
    setRenamingId(inv.id)
    setRenameValue(inv.name)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [])

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim() && renameValue.trim() !== investigations.find((i) => i.id === renamingId)?.name) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, investigations, onRename])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        commitRename()
      } else if (e.key === 'Escape') {
        setRenamingId(null)
        setRenameValue('')
      }
    },
    [commitRename]
  )

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

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    // Set visual after a frame so the browser captures the drag image first
    requestAnimationFrame(() => {
      setDragVisual({ dragIndex: index, dropSlot: index })
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number, vertical?: boolean) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const slot = vertical
      ? (e.clientY < rect.top + rect.height / 2 ? index : index + 1)
      : (e.clientX < rect.left + rect.width / 2 ? index : index + 1)
    dropSlotRef.current = slot
    const di = dragIndexRef.current
    if (di !== null) {
      setDragVisual({ dragIndex: di, dropSlot: slot })
    }
  }, [])

  const clearDrag = useCallback(() => {
    dragIndexRef.current = null
    dropSlotRef.current = null
    setDragVisual(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const sourceIndex = dragIndexRef.current
    const targetSlot = dropSlotRef.current
    clearDrag()
    if (sourceIndex === null || targetSlot === null) return

    const insertAt = targetSlot > sourceIndex ? targetSlot - 1 : targetSlot
    if (insertAt === sourceIndex) return

    const reordered = [...investigations]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(insertAt, 0, moved)
    onReorder(reordered.map((inv) => inv.id))
  }, [investigations, onReorder, clearDrag])

  const handleMiddleClick = useCallback((e: React.MouseEvent, id: string) => {
    if (e.button === 1) {
      e.preventDefault()
      onDeactivate(id)
    }
  }, [onDeactivate])

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
        onDragOver={(e) => { if (dragIndexRef.current !== null) e.preventDefault() }}
        onDrop={handleDrop}
        onDragEnd={clearDrag}
      >
        {visibleTabs.map((inv, index) => {
          const isSelected = inv.id === currentId
          const isRenaming = inv.id === renamingId
          const isDragging = dragVisual !== null && index === dragVisual.dragIndex
          const dv = dragVisual
          // Show indicator on left edge when the drop slot targets this position (and it's not a no-op)
          const showIndicatorBefore = dv !== null && dv.dropSlot === index && dv.dragIndex !== index && dv.dragIndex !== index - 1
          // Show indicator on right edge of last visible tab when dropping at end
          const showIndicatorAfter = dv !== null && index === visibleTabs.length - 1 && dv.dropSlot === visibleTabs.length && dv.dragIndex !== index && dv.dragIndex !== index + 1

          if (isRenaming) {
            return (
              <input
                key={inv.id}
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={commitRename}
                className="no-drag flex-shrink-0 bg-gray-700/60 text-gray-100 text-xs font-mono px-2 py-1 rounded outline-none border border-indigo-500/50 w-40"
              />
            )
          }

          return (
            <div key={inv.id} className="relative flex items-center">
              {showIndicatorBefore && (
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-indigo-400 rounded-full -translate-x-1 z-10" />
              )}
              <div
                className={`no-drag ${TAB_CLASS} cursor-pointer transition-colors select-none ${
                  isSelected
                    ? 'bg-gray-700/60 text-gray-100'
                    : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
                } ${isDragging ? 'opacity-40' : ''}`}
                draggable={!isRenaming}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={clearDrag}
                onDrop={handleDrop}
                onClick={() => {
                  if (isSelected) {
                    startRenaming(inv)
                  } else {
                    onSelect(inv.id)
                  }
                }}
                onMouseDown={(e) => handleMiddleClick(e, inv.id)}
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
              {showIndicatorAfter && (
                <div className="absolute right-0 top-1 bottom-1 w-0.5 bg-indigo-400 rounded-full translate-x-1 z-10" />
              )}
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
                className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700/50 rounded shadow-lg z-50 min-w-[160px] max-h-[50vh] overflow-y-auto"
                onMouseLeave={() => { if (dragIndexRef.current === null) setDropdownOpen(false) }}
                onDragOver={(e) => { if (dragIndexRef.current !== null) e.preventDefault() }}
                onDrop={handleDrop}
                onDragEnd={clearDrag}
              >
                {overflowTabs.map((inv, overflowIdx) => {
                  const fullIndex = visibleCount + overflowIdx
                  const dv = dragVisual
                  const isDragging = dv !== null && dv.dragIndex === fullIndex
                  const showIndicatorBefore = dv !== null && dv.dropSlot === fullIndex && dv.dragIndex !== fullIndex && dv.dragIndex !== fullIndex - 1
                  const showIndicatorAfter = dv !== null && overflowIdx === overflowTabs.length - 1 && dv.dropSlot === fullIndex + 1 && dv.dragIndex !== fullIndex && dv.dragIndex !== fullIndex + 1

                  return (
                    <div key={inv.id} className="relative">
                      {showIndicatorBefore && (
                        <div className="absolute left-2 right-2 top-0 h-0.5 bg-indigo-400 rounded-full z-10" />
                      )}
                      <div
                        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-700/60 transition-colors select-none ${
                          inv.id === currentId ? 'text-gray-100' : 'text-gray-400'
                        } ${isDragging ? 'opacity-40' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, fullIndex)}
                        onDragOver={(e) => handleDragOver(e, fullIndex, true)}
                        onDragEnd={clearDrag}
                        onDrop={handleDrop}
                        onClick={() => {
                          onSelect(inv.id)
                          setDropdownOpen(false)
                        }}
                        onMouseDown={(e) => handleMiddleClick(e, inv.id)}
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
                      {showIndicatorAfter && (
                        <div className="absolute left-2 right-2 bottom-0 h-0.5 bg-indigo-400 rounded-full z-10" />
                      )}
                    </div>
                  )
                })}
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
