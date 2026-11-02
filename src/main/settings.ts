import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+J'
export const DEFAULT_SCREENSHOT_HOTKEY = 'CommandOrControl+Shift+S'
export const DEFAULT_UPLOAD_HOTKEY = 'CommandOrControl+Shift+U'
export const DEFAULT_TOOLKIT_HOTKEY = 'CommandOrControl+Shift+K'
export const DEFAULT_TOKENISER_HOTKEY = 'CommandOrControl+Shift+L'
export const DEFAULT_MANAGER_HOTKEY = 'CommandOrControl+Shift+M'

interface Settings {
  hotkey: string
  screenshotHotkey: string
  uploadHotkey: string
  toolkitHotkey: string
  tokeniserHotkey: string
  managerHotkey: string
  lastViewedInvestigationId: string | null
  minimapOpen: boolean
  onboardingDismissed: boolean
  opaqueOverlay: boolean
}

const DEFAULTS: Settings = {
  hotkey: DEFAULT_HOTKEY,
  screenshotHotkey: DEFAULT_SCREENSHOT_HOTKEY,
  uploadHotkey: DEFAULT_UPLOAD_HOTKEY,
  toolkitHotkey: DEFAULT_TOOLKIT_HOTKEY,
  tokeniserHotkey: DEFAULT_TOKENISER_HOTKEY,
  managerHotkey: DEFAULT_MANAGER_HOTKEY,
  lastViewedInvestigationId: null,
  minimapOpen: false,
  onboardingDismissed: false,
  opaqueOverlay: true
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

export function getMinimapOpen(): boolean {
  return load().minimapOpen
}

export function setMinimapOpen(open: boolean): void {
  save({ ...load(), minimapOpen: open })
}

export function getOnboardingDismissed(): boolean {
  return load().onboardingDismissed
}

export function setOnboardingDismissed(dismissed: boolean): void {
  save({ ...load(), onboardingDismissed: dismissed })
}

export function getToolkitHotkey(): string {
  return load().toolkitHotkey
}

export function setToolkitHotkey(hotkey: string): void {
  save({ ...load(), toolkitHotkey: hotkey })
}

export function getTokeniserHotkey(): string {
  return load().tokeniserHotkey
}

export function setTokeniserHotkey(hotkey: string): void {
  save({ ...load(), tokeniserHotkey: hotkey })
}

export function getManagerHotkey(): string {
  return load().managerHotkey
}

export function setManagerHotkey(hotkey: string): void {
  save({ ...load(), managerHotkey: hotkey })
}

export function getOpaqueOverlay(): boolean {
  return load().opaqueOverlay
}

export function setOpaqueOverlay(opaque: boolean): void {
  save({ ...load(), opaqueOverlay: opaque })
}
