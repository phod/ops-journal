import { Notification } from 'electron'
import { listOverdueReminders, getNextActiveReminder } from './db/reminders'
import { showManagerReminders } from './windows'
import type { Reminder } from '@shared/ipc-types'

let nextTimeout: ReturnType<typeof setTimeout> | null = null
const firedReminderIds = new Set<string>()
const activeNotifications = new Set<Notification>()

export function initReminderScheduler(): void {
  checkOverdueReminders()
  rescheduleNextReminder()
}

export function rescheduleNextReminder(): void {
  if (nextTimeout !== null) {
    clearTimeout(nextTimeout)
    nextTimeout = null
  }

  const next = getNextActiveReminder()
  if (!next) return

  // Safety: if we've already fired this reminder, don't fire it again
  if (firedReminderIds.has(next.id)) return

  const delay = new Date(next.due_at).getTime() - Date.now()

  // If the reminder is in the past (shouldn't happen due to the SQL filter,
  // but guard against it), don't schedule a zero-delay loop
  if (delay <= 0) return

  nextTimeout = setTimeout(() => {
    firedReminderIds.add(next.id)
    fireReminder(next)
    rescheduleNextReminder()
  }, delay)
}

function fireReminder(reminder: Reminder): void {
  const notification = new Notification({
    title: 'Reminder',
    body: `${reminder.entry_body}${reminder.investigation_name ? `\n${reminder.investigation_name}` : ''}${reminder.note ? ` — ${reminder.note}` : ''}`,
    silent: false,
  })
  activeNotifications.add(notification)
  notification.on('click', () => {
    showManagerReminders()
    activeNotifications.delete(notification)
  })
  notification.on('close', () => {
    activeNotifications.delete(notification)
  })
  notification.show()
}

function checkOverdueReminders(): void {
  const overdue = listOverdueReminders()
  if (overdue.length === 0) return

  // Mark all as fired so the scheduler won't re-fire them
  for (const r of overdue) {
    firedReminderIds.add(r.id)
  }

  if (overdue.length === 1) {
    fireReminder(overdue[0])
  } else {
    const notification = new Notification({
      title: `You have ${overdue.length} missed reminders`,
      body: `${overdue[0].entry_body}${overdue.length > 1 ? `, and ${overdue.length - 1} more` : ''}`,
      silent: false,
    })
    activeNotifications.add(notification)
    notification.on('click', () => {
      showManagerReminders()
      activeNotifications.delete(notification)
    })
    notification.on('close', () => {
      activeNotifications.delete(notification)
    })
    notification.show()
  }
}
