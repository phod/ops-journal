/** Truncate a Date to the nearest minute (zero out seconds and milliseconds). */
export function truncateToMinute(date: Date): Date {
  const d = new Date(date)
  d.setSeconds(0, 0)
  return d
}

export interface ReminderPreset {
  label: string
  getDate: () => Date
}

export function getReminderPresets(): ReminderPreset[] {
  return [
    {
      label: 'In 1 hour',
      getDate: () => new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      label: 'In 4 hours',
      getDate: () => new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
    {
      label: 'Tomorrow 9am',
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(9, 0, 0, 0)
        return d
      },
    },
    {
      label: 'Mon 9am',
      getDate: () => {
        const d = new Date()
        const day = d.getDay()
        // Next Monday: if today is Mon (1), go to next week
        const daysUntilMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day
        d.setDate(d.getDate() + daysUntilMon)
        d.setHours(9, 0, 0, 0)
        return d
      },
    },
    {
      label: 'In 2 days',
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 2)
        d.setHours(9, 0, 0, 0)
        return d
      },
    },
    {
      label: 'In 1 week',
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        d.setHours(9, 0, 0, 0)
        return d
      },
    },
  ]
}

export function formatReminderDue(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (diffDays === 0) return `Today, ${timeStr}`
  if (diffDays === 1) return `Tomorrow, ${timeStr}`
  if (diffDays === -1) return `Yesterday, ${timeStr}`

  if (diffDays > 1 && diffDays < 7) {
    const dayName = date.toLocaleDateString(undefined, { weekday: 'long' })
    return `${dayName}, ${timeStr}`
  }

  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${dateStr}, ${timeStr}`
}

export function formatOverdueDue(isoString: string): string {
  const date = new Date(isoString)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `Was due ${dateStr}, ${timeStr}`
}
