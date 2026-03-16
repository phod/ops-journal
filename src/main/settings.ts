import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+J'
export const DEFAULT_SCREENSHOT_HOTKEY = 'CommandOrControl+Shift+S'
export const DEFAULT_UPLOAD_HOTKEY = 'CommandOrControl+Shift+U'

interface Settings {
  hotkey: string
  screenshotHotkey: string
  uploadHotkey: string
  lastViewedInvestigationId: string | null
}

const DEFAULTS: Settings = {
  hotkey: DEFAULT_HOTKEY,
  screenshotHotkey: DEFAULT_SCREENSHOT_HOTKEY,
  uploadHotkey: DEFAULT_UPLOAD_HOTKEY,
  lastViewedInvestigationId: null
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function load(): Settings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
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

export function getScreenshotHotkey(): string {
  return load().screenshotHotkey
}

export function setScreenshotHotkey(hotkey: string): void {
  save({ ...load(), screenshotHotkey: hotkey })
}

export function getUploadHotkey(): string {
  return load().uploadHotkey
}

export function setUploadHotkey(hotkey: string): void {
  save({ ...load(), uploadHotkey: hotkey })
}

export function getLastViewedInvestigationId(): string | null {
  return load().lastViewedInvestigationId
}

export function setLastViewedInvestigationId(id: string | null): void {
  save({ ...load(), lastViewedInvestigationId: id })
}
