import { globalShortcut } from 'electron'
import { toggleOverlay, showOverlay, getOverlayWindow, toggleToolkitOverlay, toggleManager } from './windows'
import {
  getHotkey, setHotkey,
  getScreenshotHotkey, setScreenshotHotkey,
  getUploadHotkey, setUploadHotkey,
  getToolkitHotkey, setToolkitHotkey,
  getManagerHotkey, setManagerHotkey
} from './settings'
import { captureScreenshot } from './screenshot'

async function handleScreenshotCapture(): Promise<void> {
  const dataUrl = await captureScreenshot()
  if (dataUrl) {
    showOverlay()
    getOverlayWindow()?.webContents.send('overlay:screenshotCaptured', dataUrl)
  }
}

function handleUploadTrigger(): void {
  showOverlay()
  getOverlayWindow()?.webContents.send('overlay:triggerUpload')
}

interface HotkeySlot {
  current: string | null
  callback: () => void
  label: string
  persist: (hotkey: string) => void
}

const overlaySlot: HotkeySlot = {
  current: null,
  callback: toggleOverlay,
  label: 'hotkey',
  persist: setHotkey
}

const screenshotSlot: HotkeySlot = {
  current: null,
  callback: handleScreenshotCapture,
  label: 'screenshot hotkey',
  persist: setScreenshotHotkey
}

const uploadSlot: HotkeySlot = {
  current: null,
  callback: handleUploadTrigger,
  label: 'upload hotkey',
  persist: setUploadHotkey
}

const toolkitSlot: HotkeySlot = {
  current: null,
  callback: toggleToolkitOverlay,
  label: 'toolkit hotkey',
  persist: setToolkitHotkey
}

const managerSlot: HotkeySlot = {
  current: null,
  callback: toggleManager,
  label: 'manager hotkey',
  persist: setManagerHotkey
}

function registerShortcut(
  accelerator: string,
  callback: () => void,
  label: string
): boolean {
  const registered = globalShortcut.register(accelerator, callback)
  if (registered) {
    console.log(`[hotkey] Registered ${label}: ${accelerator}`)
  } else {
    console.warn(`[hotkey] Failed to register ${label}: ${accelerator}`)
  }
  return registered
}

function unregisterCurrent(current: string | null): void {
  if (current) {
    globalShortcut.unregister(current)
  }
}

function registerSlot(slot: HotkeySlot, accelerator: string): boolean {
  if (registerShortcut(accelerator, slot.callback, slot.label)) {
    slot.current = accelerator
    return true
  }
  return false
}

function reregisterSlot(slot: HotkeySlot, newAccelerator: string): boolean {
  unregisterCurrent(slot.current)
  slot.current = null
  if (registerShortcut(newAccelerator, slot.callback, slot.label)) {
    slot.current = newAccelerator
    slot.persist(newAccelerator)
    return true
  }
  return false
}

export function registerHotkey(): void {
  registerSlot(overlaySlot, getHotkey())
}

export function reregisterHotkey(newHotkey: string): boolean {
  return reregisterSlot(overlaySlot, newHotkey)
}

export function registerImageHotkeys(): void {
  registerSlot(screenshotSlot, getScreenshotHotkey())
  registerSlot(uploadSlot, getUploadHotkey())
}

export function reregisterScreenshotHotkey(newHotkey: string): boolean {
  return reregisterSlot(screenshotSlot, newHotkey)
}

export function reregisterUploadHotkey(newHotkey: string): boolean {
  return reregisterSlot(uploadSlot, newHotkey)
}

export function registerToolkitHotkey(): void {
  registerSlot(toolkitSlot, getToolkitHotkey())
}

export function reregisterToolkitHotkey(newHotkey: string): boolean {
  return reregisterSlot(toolkitSlot, newHotkey)
}

export function registerManagerHotkey(): void {
  registerSlot(managerSlot, getManagerHotkey())
}

export function reregisterManagerHotkey(newHotkey: string): boolean {
  return reregisterSlot(managerSlot, newHotkey)
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
  overlaySlot.current = null
  screenshotSlot.current = null
  uploadSlot.current = null
  toolkitSlot.current = null
  managerSlot.current = null
}
