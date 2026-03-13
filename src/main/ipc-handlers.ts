import { ipcMain, BrowserWindow, dialog } from 'electron'
import {
  getActiveInvestigations,
  listInvestigations,
  createInvestigation,
  deleteInvestigation,
  setActiveInvestigation,
  deactivateInvestigation
} from './db/investigations'
import { listEntries, createEntry, updateEntry, deleteEntry, getEntry } from './db/entries'
import { getOverlayWindow, getManagerWindow, showManager, hideOverlay, navigateManagerToDetails } from './windows'
import { reregisterHotkey, reregisterScreenshotHotkey, reregisterUploadHotkey } from './hotkey'
import { getHotkey, getScreenshotHotkey, getUploadHotkey } from './settings'
import { saveImage, deleteImage, readImageAsDataUrl } from './images'
import { captureScreenshot } from './screenshot'
import type { Investigation } from '@shared/ipc-types'
import { readFileSync } from 'fs'

function broadcastInvestigationChanged(investigations: Investigation[]): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('investigation:changed', investigations)
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
    return getActiveInvestigations()
  })

  ipcMain.handle('investigation:list', () => {
    return listInvestigations()
  })

  ipcMain.handle('investigation:create', (_event, { name }: { name: string }) => {
    return createInvestigation(name)
  })

  ipcMain.handle('investigation:delete', (_event, { id }: { id: string }) => {
    deleteInvestigation(id)
    broadcastInvestigationChanged(getActiveInvestigations())
  })

  ipcMain.handle('investigation:setActive', (_event, { id }: { id: string }) => {
    const investigation = setActiveInvestigation(id)
    broadcastInvestigationChanged(getActiveInvestigations())
    return investigation
  })

  ipcMain.handle('investigation:deactivate', (_event, { id }: { id: string }) => {
    deactivateInvestigation(id)
    broadcastInvestigationChanged(getActiveInvestigations())
  })

  // --- Entries ---

  ipcMain.handle('entry:list', (_event, { investigationId }: { investigationId: string }) => {
    return listEntries(investigationId)
  })

  ipcMain.handle(
    'entry:create',
    (_event, { investigationId, body, imageDataUrls }: { investigationId: string; body: string; imageDataUrls?: string[] }) => {
      const imagePaths: string[] = []
      for (const dataUrl of (imageDataUrls ?? [])) {
        imagePaths.push(saveImage(dataUrlToBuffer(dataUrl)))
      }
      return createEntry(investigationId, body, imagePaths)
    }
  )

  ipcMain.handle('entry:update', (_event, { id, body, keepImagePaths }: { id: string; body: string; keepImagePaths?: string[] | null }) => {
    const existing = getEntry(id)
    const existingPaths = existing?.image_paths ?? []

    if (keepImagePaths === null) {
      for (const p of existingPaths) deleteImage(p)
    } else if (keepImagePaths !== undefined) {
      for (const p of existingPaths) {
        if (!keepImagePaths.includes(p)) deleteImage(p)
      }
    }

    return updateEntry(id, body, keepImagePaths)
  })

  ipcMain.handle('entry:delete', (_event, { id }: { id: string }) => {
    const entry = deleteEntry(id)
    for (const p of entry?.image_paths ?? []) deleteImage(p)
  })

  // --- Images ---

  ipcMain.handle('image:pick', async (_event) => {
    const overlayWin = getOverlayWindow()
    const result = await dialog.showOpenDialog(overlayWin ?? BrowserWindow.getFocusedWindow() ?? new BrowserWindow(), {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return result.filePaths.map((p) => {
      const buffer = readFileSync(p)
      return `data:image/png;base64,${buffer.toString('base64')}`
    })
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

  ipcMain.handle('settings:getScreenshotHotkey', () => {
    return getScreenshotHotkey()
  })

  ipcMain.handle('settings:setScreenshotHotkey', (_event, { accelerator }: { accelerator: string }) => {
    return reregisterScreenshotHotkey(accelerator)
  })

  ipcMain.handle('settings:getUploadHotkey', () => {
    return getUploadHotkey()
  })

  ipcMain.handle('settings:setUploadHotkey', (_event, { accelerator }: { accelerator: string }) => {
    return reregisterUploadHotkey(accelerator)
  })

  // --- Window management ---

  ipcMain.handle('window:openManager', () => {
    showManager()
  })

  ipcMain.handle('overlay:hide', () => {
    hideOverlay()
  })

  ipcMain.handle('window:openDetails', (_event, { id }: { id: string }) => {
    navigateManagerToDetails(id)
  })

  console.log('[ipc] All handlers registered')
}

// Export for use by tray/other non-IPC callers
export { broadcastInvestigationChanged }

// Suppress unused import warning
void getOverlayWindow
void getManagerWindow
