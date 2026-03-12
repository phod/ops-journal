const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift'])

const SPECIAL_KEYS: Record<string, string> = {
  ' ': 'Space',
  Enter: 'Return',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  '+': 'Plus',
  Escape: 'Escape'
}

export interface KeyCombo {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/**
 * Converts a KeyboardEvent-like object to an Electron accelerator string.
 * Returns null if the combo has no modifier (Cmd/Ctrl/Alt) or is modifier-only.
 */
export function toAccelerator(e: KeyCombo): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  if (!e.metaKey && !e.ctrlKey && !e.altKey) return null

  const parts: string[] = []
  if (e.metaKey) parts.push('Command')
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = SPECIAL_KEYS[e.key] ?? (/^F\d+$/.test(e.key) ? e.key : e.key.toUpperCase())
  parts.push(key)
  return parts.join('+')
}
