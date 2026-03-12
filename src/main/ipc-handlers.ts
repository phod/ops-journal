import { ipcMain, BrowserWindow, dialog } from 'electron'
import {
  getActiveInvestigation,
  listInvestigations,
  createInvestigation,
  deleteInvestigation,
  setActiveInvestigation
} from './db/investigations'
import { listEntries, createEntry, updateEntry, deleteEntry, getEntry } from './db/entries'
import { getOverlayWindow, getManagerWindow, showManager, hideOverlay } from './windows'
import { reregisterHotkey } from './hotkey'
import { getHotkey } from './settings'
import { saveImage, deleteImage, readImageAsDataUrl } from './images'
import { captureScreenshot } from './screenshot'
import type { Investigation } from '@shared/ipc-types'
import { readFileSync } from 'fs'

function broadcastInvestigationChanged(investigation: Investigation | null): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('investigation:changed', investigation)
    }
  }
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
  return Buffer.from(base64, 'base64')
}

export function registerIpcHandlers(): void {
  // --- Investigations ---

  ipcMain.handle('investigation:getActive', () => {
    return getActiveInvestigation()
  })

  ipcMain.handle('investigation:list', () => {
    return listInvestigations()
  })

  ipcMain.handle('investigation:create', (_event, { name }: { name: string }) => {
    return createInvestigation(name)
  })

  ipcMain.handle('investigation:delete', (_event, { id }: { id: string }) => {
    deleteInvestigation(id)
    // After deletion, broadcast the current active (may now be null)
    const active = getActiveInvestigation()
    broadcastInvestigationChanged(active)
  })

  ipcMain.handle('investigation:setActive', (_event, { id }: { id: string }) => {
    const investigation = setActiveInvestigation(id)
    broadcastInvestigationChanged(investigation)
    return investigation
  })

  // --- Entries ---

  ipcMain.handle('entry:list', (_event, { investigationId }: { investigationId: string }) => {
    return listEntries(investigationId)
  })

  ipcMain.handle(
    'entry:create',
    (_event, { investigationId, body, imageDataUrl }: { investigationId: string; body: string; imageDataUrl?: string }) => {
      let imagePath: string | undefined
      if (imageDataUrl) {
        const buffer = dataUrlToBuffer(imageDataUrl)
        imagePath = saveImage(buffer)
      }
      return createEntry(investigationId, body, imagePath)
    }
  )

  ipcMain.handle('entry:update', (_event, { id, body, imageDataUrl }: { id: string; body: string; imageDataUrl?: string | null }) => {
    let newImagePath: string | null | undefined = undefined

    if (imageDataUrl === null) {
      // Explicitly remove image
      const existing = getEntry(id)
      if (existing?.image_path) deleteImage(existing.image_path)
      newImagePath = null
    } else if (imageDataUrl !== undefined) {
      // Replace image
      const existing = getEntry(id)
      if (existing?.image_path) deleteImage(existing.image_path)
      const buffer = dataUrlToBuffer(imageDataUrl)
      newImagePath = saveImage(buffer)
    }

    return updateEntry(id, body, newImagePath)
  })

  ipcMain.handle('entry:delete', (_event, { id }: { id: string }) => {
    const entry = deleteEntry(id)
    if (entry?.image_path) {
      deleteImage(entry.image_path)
    }
  })

  // --- Images ---

  ipcMain.handle('image:pick', async (_event) => {
    const overlayWin = getOverlayWindow()
    const result = await dialog.showOpenDialog(overlayWin ?? BrowserWindow.getFocusedWindow() ?? new BrowserWindow(), {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const buffer = readFileSync(result.filePaths[0])
    return `data:image/png;base64,${buffer.toString('base64')}`
  })

  ipcMain.handle('image:getEntryImage', (_event, { imagePath }: { imagePath: string }) => {
    return readImageAsDataUrl(imagePath)
  })

  ipcMain.handle('screenshot:capture', async () => {
    return captureScreenshot()
  })

  // Screenshot window IPC relay — forward selection from selector window back to main
  ipcMain.on('screenshot:selection', (_event, rect) => {
    // This is handled inside captureScreenshot() via ipcMain.once
    void rect
  })

  // --- Settings ---

  ipcMain.handle('settings:getHotkey', () => {
    return getHotkey()
  })

  ipcMain.handle('settings:setHotkey', (_event, { accelerator }: { accelerator: string }) => {
    return reregisterHotkey(accelerator)
  })

  // --- Window management ---

  ipcMain.handle('window:openManager', () => {
    showManager()
  })

  ipcMain.handle('overlay:hide', () => {
    hideOverlay()
  })

  console.log('[ipc] All handlers registered')
}

// Export for use by tray/other non-IPC callers
export { broadcastInvestigationChanged }

// Suppress unused import warning
void getOverlayWindow
void getManagerWindow
