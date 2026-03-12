import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+J'

interface Settings {
  hotkey: string
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function load(): Settings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    return { hotkey: DEFAULT_HOTKEY, ...JSON.parse(raw) }
  } catch {
    return { hotkey: DEFAULT_HOTKEY }
  }
}

function save(settings: Settings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
}

export function getHotkey(): string {
  return load().hotkey
}

export function setHotkey(hotkey: string): void {
  save({ ...load(), hotkey })
}
