import { describe, it, expect } from 'vitest'
import { toAccelerator } from '../hotkey'

function key(
  k: string,
  opts: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {}
) {
  return {
    key: k,
    metaKey: opts.meta ?? false,
    ctrlKey: opts.ctrl ?? false,
    altKey: opts.alt ?? false,
    shiftKey: opts.shift ?? false
  }
}

describe('toAccelerator', () => {
  it('returns null for modifier-only keydowns', () => {
    expect(toAccelerator(key('Meta', { meta: true }))).toBeNull()
    expect(toAccelerator(key('Control', { ctrl: true }))).toBeNull()
    expect(toAccelerator(key('Alt', { alt: true }))).toBeNull()
    expect(toAccelerator(key('Shift', { shift: true }))).toBeNull()
  })

  it('returns null when no modifier is held', () => {
    expect(toAccelerator(key('j'))).toBeNull()
    expect(toAccelerator(key('j', { shift: true }))).toBeNull()
  })

  it('builds a basic Command+letter shortcut', () => {
    expect(toAccelerator(key('j', { meta: true }))).toBe('Command+J')
  })

  it('builds a Control+letter shortcut', () => {
    expect(toAccelerator(key('k', { ctrl: true }))).toBe('Control+K')
  })

  it('includes Shift in the accelerator', () => {
    expect(toAccelerator(key('j', { meta: true, shift: true }))).toBe('Command+Shift+J')
  })

  it('includes Alt in the accelerator', () => {
    expect(toAccelerator(key('p', { alt: true }))).toBe('Alt+P')
  })

  it('handles multiple modifiers', () => {
    expect(toAccelerator(key('x', { meta: true, ctrl: true, alt: true, shift: true }))).toBe(
      'Command+Control+Alt+Shift+X'
    )
  })

  it('maps special keys correctly', () => {
    expect(toAccelerator(key(' ', { meta: true }))).toBe('Command+Space')
    expect(toAccelerator(key('Enter', { meta: true }))).toBe('Command+Return')
    expect(toAccelerator(key('ArrowUp', { ctrl: true }))).toBe('Control+Up')
    expect(toAccelerator(key('ArrowDown', { ctrl: true }))).toBe('Control+Down')
    expect(toAccelerator(key('ArrowLeft', { ctrl: true }))).toBe('Control+Left')
    expect(toAccelerator(key('ArrowRight', { ctrl: true }))).toBe('Control+Right')
    expect(toAccelerator(key('+', { meta: true }))).toBe('Command+Plus')
    expect(toAccelerator(key('Backspace', { meta: true }))).toBe('Command+Backspace')
  })

  it('maps F-keys correctly', () => {
    expect(toAccelerator(key('F5', { meta: true }))).toBe('Command+F5')
    expect(toAccelerator(key('F12', { ctrl: true }))).toBe('Control+F12')
  })

  it('uppercases regular letter keys', () => {
    expect(toAccelerator(key('a', { meta: true }))).toBe('Command+A')
    expect(toAccelerator(key('Z', { ctrl: true }))).toBe('Control+Z')
  })
})
