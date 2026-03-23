import { useState } from 'react'
import { Modal } from './Modal'
import { getReminderPresets, truncateToMinute, formatOverdueDue, formatReminderDue } from './reminder-presets'
import type { Reminder } from '@shared/ipc-types'

interface Props {
  reminder: Reminder
  onClose: () => void
  onRescheduled: () => void
}

function parseDueAt(dueAt: string): { date: string; time: string } {
  const d = new Date(dueAt)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` }
}

export function RescheduleModal({ reminder, onClose, onRescheduled }: Props) {
  const prev = parseDueAt(reminder.due_at)
  const [customDate, setCustomDate] = useState(prev.date)
  const [customTime, setCustomTime] = useState(prev.time)
  const [note, setNote] = useState(reminder.note ?? '')
  const presets = getReminderPresets()

  const isOverdue = new Date(reminder.due_at) < new Date()

  async function handleReschedule(dueAt: Date) {
    await window.electronAPI.rescheduleReminder(reminder.id, truncateToMinute(dueAt).toISOString(), note || undefined)
    onRescheduled()
    onClose()
  }

  function handleCustomSubmit() {
    if (!customDate) return
    handleReschedule(new Date(`${customDate}T${customTime}`))
  }

  async function handleDelete() {
    await window.electronAPI.dismissReminder(reminder.id)
    onClose()
  }

  return (
    <Modal onClose={onClose} className="p-5 w-[380px]">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div>
          <h3 className="text-gray-100 font-semibold text-sm leading-tight">Reschedule Reminder</h3>
          <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[280px]">{reminder.entry_body}</p>
        </div>
      </div>

      {/* Current due date */}
      <div className={`flex items-center gap-2 mb-4 px-2.5 py-2 rounded-lg ${
        isOverdue ? 'bg-red-500/5 border border-red-500/15' : 'bg-gray-900/50 border border-gray-700/40'
      }`}>
        <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
          {isOverdue ? 'Was due:' : 'Currently due:'}
        </span>
        <span className="text-[10px] text-gray-400">
          {isOverdue ? formatOverdueDue(reminder.due_at).replace('Was due ', '') : formatReminderDue(reminder.due_at)}
        </span>
        {isOverdue && (
          <span className="text-[10px] px-1.5 rounded bg-red-500/15 text-red-400 font-semibold">overdue</span>
        )}
      </div>

      {/* Quick picks */}
      <div className="mb-3">
        <label className="block text-[10px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">Quick reschedule</label>
        <div className="grid grid-cols-3 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleReschedule(preset.getDate())}
              className="px-2 py-1.5 text-[11px] font-medium rounded-md border border-gray-700/50 text-gray-400 bg-gray-900/50 hover:border-indigo-500/40 hover:bg-indigo-500/15 hover:text-indigo-300 transition-colors"
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
            onChange={(e) => setCustomDate(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-indigo-500/60 transition-colors"
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
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
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 text-xs font-medium rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Delete reminder
        </button>
        <div className="flex gap-2">
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
            Reschedule
          </button>
        </div>
      </div>
    </Modal>
  )
}
