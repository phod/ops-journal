import { app } from 'electron'
import { createOverlayWindow, createManagerWindow, createToolkitOverlayWindow, getOverlayWindow, getToolkitOverlayWindow, setAppQuitting } from './windows'
import { createTray, updateTrayMenu } from './tray'
import { registerHotkey, registerImageHotkeys, registerToolkitHotkey, registerManagerHotkey, unregisterAllHotkeys } from './hotkey'
import { registerIpcHandlers } from './ipc-handlers'
import { getDb, closeDb } from './db/index'

// Hide dock icon as early as possible (macOS only)
if (process.platform === 'darwin') {
  app.dock?.hide()
  app.setActivationPolicy('accessory')
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  console.log('[main] Another instance is running — quitting.')
  app.quit()
} else {
  // If a second instance tries to open, focus the existing one
  app.on('second-instance', () => {
    const overlay = getOverlayWindow()
    if (overlay) {
      if (!overlay.isVisible()) {
        overlay.show()
      }
      overlay.focus()
    }
  })

  app.whenReady().then(() => {
    // Initialize database
    getDb()

    // Register IPC handlers before creating windows
    registerIpcHandlers()

    // Create windows (all hidden initially)
    createOverlayWindow()
    createManagerWindow()
    createToolkitOverlayWindow()

    // Create tray
    createTray()

    // Keep tray menu label in sync with overlay visibility
    const overlayWin = getOverlayWindow()
    if (overlayWin) {
      overlayWin.on('show', () => updateTrayMenu())
      overlayWin.on('hide', () => updateTrayMenu())
    }

    const toolkitWin = getToolkitOverlayWindow()
    if (toolkitWin) {
      toolkitWin.on('show', () => updateTrayMenu())
      toolkitWin.on('hide', () => updateTrayMenu())
    }

    // Register global hotkeys
    registerHotkey()
    registerImageHotkeys()
    registerToolkitHotkey()
    registerManagerHotkey()

    // macOS: re-apply accessory policy after ready (belt and suspenders)
    if (process.platform === 'darwin') {
      app.dock?.hide()
    }
  })

  app.on('before-quit', () => {
    setAppQuitting()
    unregisterAllHotkeys()
    closeDb()
  })

  // Keep the app alive even when all windows are closed
  app.on('window-all-closed', (e: Event) => {
    e.preventDefault()
  })

  // Prevent default behavior of activating app on macOS
  app.on('activate', () => {
    // Don't show any window on activate — let the user use the hotkey or tray
  })
}
