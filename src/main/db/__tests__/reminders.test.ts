import Database from 'better-sqlite3'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

let testDb: Database.Database

vi.mock('../index', () => ({
  getDb: () => testDb
}))

import { createInvestigation } from '../investigations'
import { createEntry, listEntries } from '../entries'
import {
  createReminder,
  getReminder,
  getReminderForEntry,
  listReminders,
  listOverdueReminders,
  getNextActiveReminder,
  rescheduleReminder,
  completeReminder,
  dismissReminder,
  deleteReminder
} from '../reminders'

let investigationId: string
let actionEntryId: string

beforeEach(() => {
  testDb = createTestDb()
  const inv = createInvestigation('Test Investigation')
  investigationId = inv.id
  const entry = createEntry(investigationId, 'Follow up with SRE', [], 'action')
  actionEntryId = entry.id
})

afterEach(() => {
  testDb.close()
})

describe('createReminder', () => {
  it('creates a reminder linked to an action entry', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const reminder = createReminder(actionEntryId, futureDate, 'Check #sre-oncall')
    expect(reminder.id).toBeTruthy()
    expect(reminder.entry_id).toBe(actionEntryId)
    expect(reminder.due_at).toBe(futureDate)
    expect(reminder.note).toBe('Check #sre-oncall')
    expect(reminder.status).toBe('active')
    expect(reminder.entry_body).toBe('Follow up with SRE')
    expect(reminder.investigation_name).toBe('Test Investigation')
  })

  it('creates a reminder without a note', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const reminder = createReminder(actionEntryId, futureDate)
    expect(reminder.note).toBeNull()
  })

  it('throws if entry already has an active reminder', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    createReminder(actionEntryId, futureDate)
    expect(() => createReminder(actionEntryId, futureDate)).toThrow('Entry already has an active reminder')
  })

  it('allows creating a new reminder after the previous one is completed', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const first = createReminder(actionEntryId, futureDate)
    completeReminder(first.id)
    const second = createReminder(actionEntryId, futureDate)
    expect(second.id).not.toBe(first.id)
    expect(second.status).toBe('active')
  })
})

describe('getReminder', () => {
  it('returns a reminder by id', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const created = createReminder(actionEntryId, futureDate)
    const fetched = getReminder(created.id)
    expect(fetched).toBeDefined()
    expect(fetched!.id).toBe(created.id)
  })

  it('returns undefined for non-existent id', () => {
    expect(getReminder('nonexistent')).toBeUndefined()
  })
})

describe('getReminderForEntry', () => {
  it('returns active reminder for entry', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    createReminder(actionEntryId, futureDate)
    const found = getReminderForEntry(actionEntryId)
    expect(found).toBeDefined()
    expect(found!.entry_id).toBe(actionEntryId)
  })

  it('returns undefined if no active reminder', () => {
    expect(getReminderForEntry(actionEntryId)).toBeUndefined()
  })

  it('does not return completed reminders', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, futureDate)
    completeReminder(r.id)
    expect(getReminderForEntry(actionEntryId)).toBeUndefined()
  })
})

describe('listReminders', () => {
  it('returns all reminders with joined data', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    createReminder(actionEntryId, futureDate, 'A note')
    const all = listReminders()
    expect(all.length).toBe(1)
    expect(all[0].entry_body).toBe('Follow up with SRE')
    expect(all[0].investigation_name).toBe('Test Investigation')
    expect(all[0].note).toBe('A note')
  })
})

describe('listOverdueReminders', () => {
  it('returns only active reminders past their due date', () => {
    // Use UTC format matching SQLite's datetime() format for reliable comparison
    const pastDate = '2020-01-01 00:00:00'
    createReminder(actionEntryId, pastDate)

    const entry2 = createEntry(investigationId, 'Another action', [], 'action')
    const futureDate = '2099-01-01 00:00:00'
    createReminder(entry2.id, futureDate)

    const overdue = listOverdueReminders()
    expect(overdue.length).toBe(1)
    expect(overdue[0].entry_id).toBe(actionEntryId)
  })
})

describe('getNextActiveReminder', () => {
  it('returns the soonest active reminder in the future', () => {
    const soon = new Date(Date.now() + 3600000).toISOString()
    const later = new Date(Date.now() + 7200000).toISOString()

    createReminder(actionEntryId, soon)
    const entry2 = createEntry(investigationId, 'Second action', [], 'action')
    createReminder(entry2.id, later)

    const next = getNextActiveReminder()
    expect(next).toBeDefined()
    expect(next!.entry_id).toBe(actionEntryId)
  })

  it('returns undefined if no active reminders', () => {
    expect(getNextActiveReminder()).toBeUndefined()
  })
})

describe('rescheduleReminder', () => {
  it('updates the due_at of a reminder', () => {
    const original = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, original)
    const newDate = new Date(Date.now() + 7200000).toISOString()
    const updated = rescheduleReminder(r.id, newDate)
    expect(updated.due_at).toBe(newDate)
    expect(updated.status).toBe('active')
  })

  it('can update the note', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, futureDate, 'Old note')
    const updated = rescheduleReminder(r.id, futureDate, 'New note')
    expect(updated.note).toBe('New note')
  })

  it('reactivates a completed reminder', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, futureDate)
    completeReminder(r.id)
    expect(getReminder(r.id)!.status).toBe('completed')

    const newDate = new Date(Date.now() + 7200000).toISOString()
    const updated = rescheduleReminder(r.id, newDate)
    expect(updated.status).toBe('active')
    expect(updated.due_at).toBe(newDate)
  })

  it('throws when reactivating if entry already has a different active reminder', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r1 = createReminder(actionEntryId, futureDate)
    completeReminder(r1.id)

    // Create a new active reminder on the same entry
    const r2 = createReminder(actionEntryId, futureDate)
    expect(r2.status).toBe('active')

    // Trying to reschedule the completed one should fail
    expect(() => rescheduleReminder(r1.id, futureDate)).toThrow('Entry already has an active reminder')
  })
})

describe('completeReminder', () => {
  it('sets status to completed', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, futureDate)
    const completed = completeReminder(r.id)
    expect(completed.status).toBe('completed')
  })
})

describe('dismissReminder', () => {
  it('sets status to dismissed', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, futureDate)
    dismissReminder(r.id)
    const fetched = getReminder(r.id)
    expect(fetched!.status).toBe('dismissed')
  })
})

describe('deleteReminder', () => {
  it('permanently removes the reminder', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, futureDate)
    deleteReminder(r.id)
    expect(getReminder(r.id)).toBeUndefined()
    expect(listReminders().length).toBe(0)
  })
})

describe('cascade delete', () => {
  it('deletes reminders when the entry is deleted', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, futureDate)
    testDb.prepare('DELETE FROM journal_entries WHERE id = ?').run(actionEntryId)
    expect(getReminder(r.id)).toBeUndefined()
  })
})

describe('entry augmentation', () => {
  it('includes active reminder in entry query', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    createReminder(actionEntryId, futureDate, 'Test note')
    const entries = listEntries(investigationId)
    const action = entries.find((e) => e.id === actionEntryId)
    expect(action!.reminder).toBeDefined()
    expect(action!.reminder!.due_at).toBe(futureDate)
    expect(action!.reminder!.note).toBe('Test note')
  })

  it('does not include completed reminder in entry query', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    const r = createReminder(actionEntryId, futureDate)
    completeReminder(r.id)
    const entries = listEntries(investigationId)
    const action = entries.find((e) => e.id === actionEntryId)
    expect(action!.reminder).toBeUndefined()
  })
})
