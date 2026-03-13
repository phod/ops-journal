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

export function registerImageHotkeys(): void {
  const screenshotHotkey = getScreenshotHotkey()
  const screenshotRegistered = globalShortcut.register(screenshotHotkey, async () => {
    const dataUrl = await captureScreenshot()
    if (dataUrl) {
      showOverlay()
      getOverlayWindow()?.webContents.send('overlay:screenshotCaptured', dataUrl)
    }
  })
  if (screenshotRegistered) {
    currentScreenshotHotkey = screenshotHotkey
    console.log(`[hotkey] Registered screenshot hotkey: ${screenshotHotkey}`)
  } else {
    console.warn(`[hotkey] Failed to register screenshot hotkey: ${screenshotHotkey}`)
  }

  const uploadHotkey = getUploadHotkey()
  const uploadRegistered = globalShortcut.register(uploadHotkey, () => {
    showOverlay()
    getOverlayWindow()?.webContents.send('overlay:triggerUpload')
  })
  if (uploadRegistered) {
    currentUploadHotkey = uploadHotkey
    console.log(`[hotkey] Registered upload hotkey: ${uploadHotkey}`)
  } else {
    console.warn(`[hotkey] Failed to register upload hotkey: ${uploadHotkey}`)
  }
}

export function reregisterScreenshotHotkey(newHotkey: string): boolean {
  if (currentScreenshotHotkey) {
    globalShortcut.unregister(currentScreenshotHotkey)
    currentScreenshotHotkey = null
  }
  const registered = globalShortcut.register(newHotkey, async () => {
    const dataUrl = await captureScreenshot()
    if (dataUrl) {
      showOverlay()
      getOverlayWindow()?.webContents.send('overlay:screenshotCaptured', dataUrl)
    }
  })
  if (registered) {
    currentScreenshotHotkey = newHotkey
    setScreenshotHotkey(newHotkey)
  }
  return registered
}

export function reregisterUploadHotkey(newHotkey: string): boolean {
  if (currentUploadHotkey) {
    globalShortcut.unregister(currentUploadHotkey)
    currentUploadHotkey = null
  }
  const registered = globalShortcut.register(newHotkey, () => {
    showOverlay()
    getOverlayWindow()?.webContents.send('overlay:triggerUpload')
  })
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
