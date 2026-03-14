import { describe, it, expect } from 'vitest'
import { getEntryTypeDefinition, ENTRY_TYPES, SLASH_COMMANDS } from '../entry-types'

describe('getEntryTypeDefinition', () => {
  it('returns the note definition', () => {
    const def = getEntryTypeDefinition('note')
    expect(def.type).toBe('note')
    expect(def.label).toBe('Note')
    expect(def.command).toBeNull()
  })

  it('returns the action definition', () => {
    const def = getEntryTypeDefinition('action')
    expect(def.type).toBe('action')
    expect(def.label).toBe('Action')
    expect(def.command).toBe('/action')
  })

  it('returns the finding definition', () => {
    const def = getEntryTypeDefinition('finding')
    expect(def.type).toBe('finding')
    expect(def.label).toBe('Finding')
    expect(def.command).toBe('/finding')
  })

  it('returns the hypothesis definition', () => {
    const def = getEntryTypeDefinition('hypothesis')
    expect(def.type).toBe('hypothesis')
    expect(def.label).toBe('Hypothesis')
    expect(def.command).toBe('/hypothesis')
  })

  it('falls back to note for an unknown type', () => {
    // @ts-expect-error testing runtime fallback
    const def = getEntryTypeDefinition('unknown')
    expect(def.type).toBe('note')
  })

  it('action, finding, and hypothesis have non-empty tag styling classes', () => {
    for (const type of ['action', 'finding', 'hypothesis'] as const) {
      const def = getEntryTypeDefinition(type)
      expect(def.tagBgClass).not.toBe('')
      expect(def.tagTextClass).not.toBe('')
    }
  })
})

describe('SLASH_COMMANDS', () => {
  it('excludes note (which has no command)', () => {
    expect(SLASH_COMMANDS.every((d) => d.type !== 'note')).toBe(true)
  })

  it('includes action, finding, and hypothesis', () => {
    const types = SLASH_COMMANDS.map((d) => d.type)
    expect(types).toContain('action')
    expect(types).toContain('finding')
    expect(types).toContain('hypothesis')
  })

  it('all commands start with /', () => {
    expect(SLASH_COMMANDS.every((d) => d.command?.startsWith('/'))).toBe(true)
  })
})

describe('ENTRY_TYPES', () => {
  it('contains note, action, finding, and hypothesis', () => {
    const types = ENTRY_TYPES.map((d) => d.type)
    expect(types).toContain('note')
    expect(types).toContain('action')
    expect(types).toContain('finding')
    expect(types).toContain('hypothesis')
  })

  it('note has a null command', () => {
    const note = ENTRY_TYPES.find((d) => d.type === 'note')!
    expect(note.command).toBeNull()
  })
})
