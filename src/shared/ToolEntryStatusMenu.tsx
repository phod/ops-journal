import { useRef, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ToolEntryStatus } from '@shared/ipc-types'
import { TOOL_ENTRY_STATUS_LABEL, TOOL_ENTRY_STATUS_CLASS } from '@shared/entry-types'

interface Props {
  currentStatus: ToolEntryStatus
  onSelect: (status: ToolEntryStatus) => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export function ToolEntryStatusMenu({ currentStatus, onSelect, anchorRef }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? 100
    const spaceBelow = window.innerHeight - rect.bottom
    if (spaceBelow >= menuHeight + 4) {
      setPos({ top: rect.bottom + 4, left: rect.left })
    } else {
      setPos({ top: rect.top - menuHeight - 4, left: rect.left })
    }
  }, [anchorRef])

  return createPortal(
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-[9999] min-w-[110px] shadow-lg"
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
    >
      {(Object.keys(TOOL_ENTRY_STATUS_LABEL) as ToolEntryStatus[]).map((s) => (
        <button
          key={s}
          onMouseDown={(e) => { e.preventDefault(); onSelect(s) }}
          className={`no-drag w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors hover:bg-gray-700 ${
            currentStatus === s ? 'text-gray-100' : 'text-gray-400'
          }`}
        >
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${TOOL_ENTRY_STATUS_CLASS[s]}`}>
            {TOOL_ENTRY_STATUS_LABEL[s]}
          </span>
          {currentStatus === s && <span className="ml-auto text-gray-500">✓</span>}
        </button>
      ))}
    </div>,
    document.body
  )
}
