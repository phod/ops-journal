import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDate, formatRelativeTime, formatDateShort } from '../format-date'

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2024-06-15T14:30:00Z')
    expect(result).toBeTruthy()
    // The exact day depends on timezone, so just check it looks like a formatted date
    expect(result).toContain('Jun')
    expect(result).toContain('2024')
  })

  it('appends Z to strings missing timezone', () => {
    const withZ = formatDate('2024-06-15T14:30:00Z')
    const withoutZ = formatDate('2024-06-15T14:30:00')
    expect(withZ).toBe(withoutZ)
  })

  it('accepts custom format options', () => {
    const result = formatDate('2024-06-15T14:30:00Z', { year: 'numeric', month: 'long' })
    expect(result).toContain('2024')
  })

  it('returns "Invalid Date" for unparseable input rather than throwing', () => {
    // new Date('not-a-date') produces Invalid Date without throwing
    const result = formatDate('not-a-date')
    expect(result).toBeTruthy()
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for times less than 60 seconds ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:30Z'))
    expect(formatRelativeTime('2024-06-15T12:00:00Z')).toBe('just now')
  })

  it('returns minutes ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:05:00Z'))
    expect(formatRelativeTime('2024-06-15T12:00:00Z')).toBe('5m ago')
  })

  it('returns hours ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T15:00:00Z'))
    expect(formatRelativeTime('2024-06-15T12:00:00Z')).toBe('3h ago')
  })

  it('returns "yesterday" for 1 day ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-16T12:00:00Z'))
    expect(formatRelativeTime('2024-06-15T12:00:00Z')).toBe('yesterday')
  })

  it('returns days ago for 2-6 days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-18T12:00:00Z'))
    expect(formatRelativeTime('2024-06-15T12:00:00Z')).toBe('3d ago')
  })

  it('returns a formatted date for 7+ days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-25T12:00:00Z'))
    const result = formatRelativeTime('2024-06-15T12:00:00Z')
    expect(result).toContain('Jun')
    expect(result).toContain('15')
  })

  it('handles unparseable input without throwing', () => {
    const result = formatRelativeTime('garbage')
    expect(result).toBeTruthy()
  })
})

describe('formatDateShort', () => {
  it('formats a date in short form', () => {
    const result = formatDateShort('2024-06-15T14:30:00Z')
    expect(result).toContain('Jun')
    expect(result).toContain('2024')
  })

  it('appends Z to strings missing timezone', () => {
    const withZ = formatDateShort('2024-06-15T14:30:00Z')
    const withoutZ = formatDateShort('2024-06-15T14:30:00')
    expect(withZ).toBe(withoutZ)
  })

  it('handles unparseable input without throwing', () => {
    const result = formatDateShort('nope')
    expect(result).toBeTruthy()
  })
})
