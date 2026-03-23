import { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getReminderPresets, truncateToMinute } from '@shared/reminder-presets'

interface Props {
  entryId: string
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onCreated: () => void
}

export function ReminderPopover({ entryId, anchorRef, onClose, onCreated }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('09:00')
  const [note, setNote] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const presets = getReminderPresets()

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? 300
    const menuWidth = menuRef.current?.offsetWidth ?? 300
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= menuHeight + 4 ? rect.bottom + 4 : rect.top - menuHeight - 4
    const left = Math.min(rect.left, window.innerWidth - menuWidth - 8)
    setPos({ top, left })
  }, [anchorRef])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  async function handleSubmit(dueAt: Date) {
    await window.electronAPI.createReminder(entryId, truncateToMinute(dueAt).toISOString(), note || undefined)
    onCreated()
    onClose()
  }

  function handlePresetClick(index: number) {
    setSelectedPreset(index)
    const preset = presets[index]
    handleSubmit(preset.getDate())
  }

  function handleCustomSubmit() {
    if (!customDate) return
    const dueAt = new Date(`${customDate}T${customTime}`)
    handleSubmit(dueAt)
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-700 rounded-xl z-[9999] shadow-2xl p-4 w-[300px]"
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span className="text-xs font-semibold text-gray-200">Set Reminder</span>
      </div>

      {/* Quick picks */}
      <div className="mb-3">
        <label className="block text-[10px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">Quick pick</label>
        <div className="grid grid-cols-3 gap-1.5">
          {presets.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(i)}
              className={`px-2 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${
                selectedPreset === i
                  ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                  : 'border-gray-700/50 text-gray-400 bg-gray-900/50 hover:border-indigo-500/40 hover:bg-indigo-500/15 hover:text-indigo-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date/time */}
      <div className="mb-3">
        <label className="block text-[10px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">Or pick a date & time</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={customDate}
            onChange={(e) => { setCustomDate(e.target.value); setSelectedPreset(null) }}
            style={{ colorScheme: 'dark' }}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-indigo-500/60 transition-colors"
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => { setCustomTime(e.target.value); setSelectedPreset(null) }}
            style={{ colorScheme: 'dark' }}
            className="w-[100px] bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>
      </div>

      {/* Note */}
      <div className="mb-4">
        <label className="block text-[10px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
          Note <span className="text-gray-600 normal-case">(optional)</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Ask about config in #sre-oncall"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCustomSubmit}
          disabled={!customDate}
          className="px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Set Reminder
        </button>
      </div>
    </div>,
    document.body
  )
}
