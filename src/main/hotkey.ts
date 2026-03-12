import { globalShortcut } from 'electron'
import { toggleOverlay } from './windows'
import { getHotkey, setHotkey } from './settings'

let currentHotkey: string | null = null

export function registerHotkey(): void {
  const hotkey = getHotkey()
  const registered = globalShortcut.register(hotkey, toggleOverlay)
  if (!registered) {
    console.warn(`[hotkey] Failed to register: ${hotkey}`)
  } else {
    currentHotkey = hotkey
    console.log(`[hotkey] Registered: ${hotkey}`)
  }
}

export function reregisterHotkey(newHotkey: string): boolean {
  if (currentHotkey) {
    globalShortcut.unregister(currentHotkey)
    currentHotkey = null
  }
  const registered = globalShortcut.register(newHotkey, toggleOverlay)
  if (registered) {
    currentHotkey = newHotkey
    setHotkey(newHotkey)
  }
  return registered
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
  currentHotkey = null
}
