import { globalShortcut } from 'electron'
import { toggleOverlay, showOverlay, getOverlayWindow } from './windows'
import {
  getHotkey, setHotkey,
  getScreenshotHotkey, setScreenshotHotkey,
  getUploadHotkey, setUploadHotkey
} from './settings'
import { captureScreenshot } from './screenshot'

let currentHotkey: string | null = null
let currentScreenshotHotkey: string | null = null
let currentUploadHotkey: string | null = null

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

export function registerHotkey(): void {
  const hotkey = getHotkey()
  if (registerShortcut(hotkey, toggleOverlay, 'hotkey')) {
    currentHotkey = hotkey
  }
}

export function reregisterHotkey(newHotkey: string): boolean {
  unregisterCurrent(currentHotkey)
  currentHotkey = null
  const registered = registerShortcut(newHotkey, toggleOverlay, 'hotkey')
  if (registered) {
    currentHotkey = newHotkey
    setHotkey(newHotkey)
  }
  return registered
}

export function registerImageHotkeys(): void {
  const screenshotHotkey = getScreenshotHotkey()
  if (registerShortcut(screenshotHotkey, handleScreenshotCapture, 'screenshot hotkey')) {
    currentScreenshotHotkey = screenshotHotkey
  }

  const uploadHotkey = getUploadHotkey()
  if (registerShortcut(uploadHotkey, handleUploadTrigger, 'upload hotkey')) {
    currentUploadHotkey = uploadHotkey
  }
}

export function reregisterScreenshotHotkey(newHotkey: string): boolean {
  unregisterCurrent(currentScreenshotHotkey)
  currentScreenshotHotkey = null
  const registered = registerShortcut(newHotkey, handleScreenshotCapture, 'screenshot hotkey')
  if (registered) {
    currentScreenshotHotkey = newHotkey
    setScreenshotHotkey(newHotkey)
  }
  return registered
}

export function reregisterUploadHotkey(newHotkey: string): boolean {
  unregisterCurrent(currentUploadHotkey)
  currentUploadHotkey = null
  const registered = registerShortcut(newHotkey, handleUploadTrigger, 'upload hotkey')
  if (registered) {
    currentUploadHotkey = newHotkey
    setUploadHotkey(newHotkey)
  }
  return registered
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
  currentHotkey = null
  currentScreenshotHotkey = null
  currentUploadHotkey = null
}
