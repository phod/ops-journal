import { describe, it, expect } from 'vitest'
import { parseSlashCommand, getCompletions } from '../slash-commands'

describe('parseSlashCommand', () => {
  it('parses /action command', () => {
    const result = parseSlashCommand('/action something happened')
    expect(result.type).toBe('action')
    expect(result.body).toBe('something happened')
  })

  it('parses /finding command', () => {
    const result = parseSlashCommand('/finding root cause identified')
    expect(result.type).toBe('finding')
    expect(result.body).toBe('root cause identified')
  })

  it('parses /hypothesis command', () => {
    const result = parseSlashCommand('/hypothesis maybe the cache is stale')
    expect(result.type).toBe('hypothesis')
    expect(result.body).toBe('maybe the cache is stale')
  })

  it('parses /tool command', () => {
    const result = parseSlashCommand('/tool kubectl get pods')
    expect(result.type).toBe('tool')
    expect(result.body).toBe('kubectl get pods')
  })

  it('returns note type when no command present', () => {
    const result = parseSlashCommand('just a plain note')
    expect(result.type).toBe('note')
    expect(result.body).toBe('just a plain note')
  })

  it('returns note when command is not at start', () => {
    const result = parseSlashCommand('some text /action mid-sentence')
    expect(result.type).toBe('note')
    expect(result.body).toBe('some text /action mid-sentence')
  })

  it('handles command with no body', () => {
    const result = parseSlashCommand('/action')
    expect(result.type).toBe('action')
    expect(result.body).toBe('')
  })

  it('handles command with only whitespace body', () => {
    const result = parseSlashCommand('/finding   ')
    expect(result.type).toBe('finding')
    expect(result.body).toBe('')
  })

  it('returns note for unknown slash command', () => {
    const result = parseSlashCommand('/unknown something')
    expect(result.type).toBe('note')
    expect(result.body).toBe('/unknown something')
  })

  it('strips leading whitespace before command', () => {
    const result = parseSlashCommand('  /action test')
    expect(result.type).toBe('action')
    expect(result.body).toBe('test')
  })
})

describe('getCompletions', () => {
  it('returns all commands for bare /', () => {
    const results = getCompletions('/')
    expect(results.length).toBe(4)
    expect(results.map((r) => r.type)).toContain('action')
    expect(results.map((r) => r.type)).toContain('finding')
    expect(results.map((r) => r.type)).toContain('hypothesis')
    expect(results.map((r) => r.type)).toContain('tool')
  })

  it('returns only action for /a', () => {
    const results = getCompletions('/a')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('action')
  })

  it('returns only finding for /f', () => {
    const results = getCompletions('/f')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('finding')
  })

  it('returns only hypothesis for /h', () => {
    const results = getCompletions('/h')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('hypothesis')
  })

  it('returns only tool for /t', () => {
    const results = getCompletions('/t')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('tool')
  })

  it('returns empty for /x', () => {
    const results = getCompletions('/x')
    expect(results).toHaveLength(0)
  })

  it('returns empty when no leading slash', () => {
    const results = getCompletions('action')
    expect(results).toHaveLength(0)
  })

  it('returns empty for empty string', () => {
    const results = getCompletions('')
    expect(results).toHaveLength(0)
  })

  it('is case-insensitive', () => {
    const results = getCompletions('/A')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('action')
  })

  it('returns empty when prefix exactly matches a command', () => {
    expect(getCompletions('/action')).toHaveLength(0)
    expect(getCompletions('/finding')).toHaveLength(0)
    expect(getCompletions('/hypothesis')).toHaveLength(0)
    expect(getCompletions('/tool')).toHaveLength(0)
  })
})
