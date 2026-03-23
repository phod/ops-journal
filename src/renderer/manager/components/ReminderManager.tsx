import { useState, useEffect, useCallback } from 'react'
import type { Reminder } from '@shared/ipc-types'
import { formatReminderDue, formatOverdueDue } from '@shared/reminder-presets'
import { RescheduleModal } from '@shared/RescheduleModal'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  onActiveCountChange: (count: number) => void
}

export function ReminderManager({ onActiveCountChange }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(true)
  const [rescheduleTarget, setRescheduleTarget] = useState<Reminder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null)

  const fetchReminders = useCallback(async () => {
    const list = await window.electronAPI.listReminders()
    setReminders(list)
    const activeCount = list.filter((r) => r.status === 'active').length
    onActiveCountChange(activeCount)
  }, [onActiveCountChange])

  useEffect(() => {
    fetchReminders().finally(() => setLoading(false))
  }, [fetchReminders])

  useEffect(() => {
    return window.electronAPI.onRemindersChanged(() => fetchReminders())
  }, [fetchReminders])

  const now = new Date()
  const overdue = reminders.filter((r) => r.status === 'active' && new Date(r.due_at) < now)
  const upcoming = reminders.filter((r) => r.status === 'active' && new Date(r.due_at) >= now)
  const completed = reminders.filter((r) => r.status === 'completed' || r.status === 'dismissed')

  async function handleComplete(id: string) {
    await window.electronAPI.completeReminder(id)
  }

  async function handleDismiss(id: string) {
    await window.electronAPI.dismissReminder(id)
  }

  async function handleDelete(id: string) {
    await window.electronAPI.deleteReminder(id)
    setDeleteTarget(null)
  }

  if (loading) {
    return <div className="text-gray-500 text-sm py-8 text-center">Loading…</div>
  }

  if (reminders.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-8 h-8 text-gray-700 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <p className="text-xs text-gray-600">No reminders yet</p>
        <p className="text-[10px] text-gray-700 mt-1">Set reminders on Action entries in the overlay to see them here</p>
      </div>
    )
  }

  return (
    <div>
      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400">Overdue</h3>
            <span className="text-[10px] px-1.5 rounded-full bg-red-500/15 text-red-400 font-semibold border border-red-500/25">
              {overdue.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {overdue.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                variant="overdue"
                onComplete={() => handleComplete(r.id)}
                onReschedule={() => setRescheduleTarget(r)}
                onDismiss={() => handleDismiss(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">Upcoming</h3>
            <span className="text-[10px] px-1.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30">
              {upcoming.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {upcoming.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                variant="upcoming"
                onComplete={() => handleComplete(r.id)}
                onReschedule={() => setRescheduleTarget(r)}
                onDismiss={() => handleDismiss(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-2 mb-3 cursor-pointer group"
          >
            <span className={`text-gray-600 text-[10px] transition-transform duration-200 ${showCompleted ? 'rotate-90' : ''}`}>
              ▶
            </span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-400 transition-colors">
              Completed
            </h3>
            <span className="text-[10px] px-1.5 rounded-full bg-gray-700/40 text-gray-500 font-semibold">
              {completed.length}
            </span>
          </button>
          {showCompleted && (
            <div className="space-y-1.5">
              {completed.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-700/20 bg-gray-800/20 group"
                >
                  <svg className="w-4 h-4 text-green-500/40 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 truncate line-through">{r.entry_body}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-600">
                        {r.status === 'completed' ? 'Completed' : 'Dismissed'} {new Date(r.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-[10px] text-gray-700">·</span>
                      <button
                        onClick={() => window.electronAPI.openDetails(r.investigation_id)}
                        className="text-[10px] text-gray-600 truncate hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        {r.investigation_name}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setRescheduleTarget(r)}
                      className="px-2 py-1 text-[10px] font-medium rounded-md bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/30 transition-colors"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => setDeleteTarget(r)}
                      className="px-2 py-1 text-[10px] font-medium rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rescheduleTarget && (
        <RescheduleModal
          reminder={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={() => setRescheduleTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Reminder"
          message={`Permanently delete the reminder for "${deleteTarget.entry_body}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

interface ReminderRowProps {
  reminder: Reminder
  variant: 'overdue' | 'upcoming'
  onComplete: () => void
  onReschedule: () => void
  onDismiss: () => void
}

function ReminderRow({ reminder, variant, onComplete, onReschedule, onDismiss }: ReminderRowProps) {
  const isOverdue = variant === 'overdue'

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border group transition-colors ${
        isOverdue
          ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
          : 'border-gray-700/40 bg-gray-800/30 hover:bg-gray-700/30'
      }`}
    >
      <svg className={`w-4 h-4 flex-shrink-0 ${isOverdue ? 'text-red-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-200 truncate">{reminder.entry_body}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
            {isOverdue ? formatOverdueDue(reminder.due_at) : formatReminderDue(reminder.due_at)}
          </span>
          <span className="text-[10px] text-gray-600">·</span>
          <button
            onClick={() => window.electronAPI.openDetails(reminder.investigation_id)}
            className="text-[10px] text-gray-500 truncate hover:text-indigo-400 transition-colors cursor-pointer"
          >
            {reminder.investigation_name}
          </button>
          {reminder.note && (
            <>
              <span className="text-[10px] text-gray-600">·</span>
              <span className="text-[10px] text-gray-600 italic truncate">{reminder.note}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onReschedule}
          className="px-2 py-1 text-[10px] font-medium rounded-md bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/30 transition-colors"
        >
          Reschedule
        </button>
        <button
          onClick={onComplete}
          className="px-2 py-1 text-[10px] font-medium rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 transition-colors"
        >
          Done
        </button>
        <button
          onClick={onDismiss}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-gray-700/60 transition-colors text-xs"
          data-tooltip="Remove reminder"
        >
          ···
        </button>
      </div>
    </div>
  )
}
