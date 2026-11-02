import { app } from 'electron'
import { createOverlayWindow, createManagerWindow, createToolkitOverlayWindow, createTokeniserOverlayWindow, getOverlayWindow, getToolkitOverlayWindow, getTokeniserOverlayWindow, setAppQuitting, checkManagerDirty, managerMayBeDirty } from './windows'
import { createTray, updateTrayMenu } from './tray'
import { registerHotkey, registerImageHotkeys, registerToolkitHotkey, registerTokeniserHotkey, registerManagerHotkey, unregisterAllHotkeys } from './hotkey'
import { registerIpcHandlers } from './ipc-handlers'
import { getDb, closeDb } from './db/index'
import { initReminderScheduler } from './reminder-scheduler'

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
    if (overlay && !overlay.isDestroyed()) {
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

    // Start reminder scheduler
    initReminderScheduler()

    // Create windows (all hidden initially)
    createOverlayWindow()
    createManagerWindow()
    createToolkitOverlayWindow()
    createTokeniserOverlayWindow()

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

    const tokeniserWin = getTokeniserOverlayWindow()
    if (tokeniserWin) {
      tokeniserWin.on('show', () => updateTrayMenu())
      tokeniserWin.on('hide', () => updateTrayMenu())
    }

    // Register global hotkeys
    registerHotkey()
    registerImageHotkeys()
    registerToolkitHotkey()
    registerTokeniserHotkey()
    registerManagerHotkey()

    // macOS: re-apply accessory policy after ready (belt and suspenders)
    if (process.platform === 'darwin') {
      app.dock?.hide()
    }
  })

  let quitConfirmed = false
  app.on('before-quit', (e) => {
    if (quitConfirmed) {
      setAppQuitting()
      unregisterAllHotkeys()
      closeDb()
      return
    }
    if (!managerMayBeDirty()) {
      // No visible manager — nothing to check, let quit proceed synchronously
      setAppQuitting()
      unregisterAllHotkeys()
      closeDb()
      return
    }
    // Manager is visible — ask renderer if there are unsaved changes
    e.preventDefault()
    checkManagerDirty().then((canProceed) => {
      if (canProceed) {
        quitConfirmed = true
        app.quit()
      }
    })
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
