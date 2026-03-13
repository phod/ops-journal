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
import { getOverlayWindow, showManager, hideOverlay, navigateManagerToDetails } from './windows'
import { reregisterHotkey, reregisterScreenshotHotkey, reregisterUploadHotkey } from './hotkey'
import { getHotkey, getScreenshotHotkey, getUploadHotkey } from './settings'
import { saveImage, deleteImage, readImageAsDataUrl } from './images'
import { captureScreenshot } from './screenshot'
import type { Investigation } from '@shared/ipc-types'

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

  ipcMain.handle('investigation:getActive', () => getActiveInvestigations())

  ipcMain.handle('investigation:list', () => listInvestigations())

  ipcMain.handle('investigation:create', (_event, { name }: { name: string }) => createInvestigation(name))

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

  ipcMain.handle('entry:list', (_event, { investigationId }: { investigationId: string }) => listEntries(investigationId))

  ipcMain.handle(
    'entry:create',
    (_event, { investigationId, body, imageDataUrls }: { investigationId: string; body: string; imageDataUrls?: string[] }) => {
      const imagePaths = (imageDataUrls ?? []).map((dataUrl) => saveImage(dataUrlToBuffer(dataUrl)))
      return createEntry(investigationId, body, imagePaths)
    }
  )

  ipcMain.handle('entry:update', (_event, { id, body, keepImagePaths }: { id: string; body: string; keepImagePaths?: string[] | null }) => {
    const existingPaths = getEntry(id)?.image_paths ?? []

    if (keepImagePaths !== undefined) {
      const pathsToKeep = keepImagePaths ?? []
      for (const p of existingPaths) {
        if (!pathsToKeep.includes(p)) deleteImage(p)
      }
    }

    return updateEntry(id, body, keepImagePaths)
  })

  ipcMain.handle('entry:delete', (_event, { id }: { id: string }) => {
    const entry = deleteEntry(id)
    for (const p of entry?.image_paths ?? []) deleteImage(p)
  })

  // --- Images ---

  ipcMain.handle('image:pick', async () => {
    const parentWindow = getOverlayWindow() ?? BrowserWindow.getFocusedWindow()
    const dialogOptions = {
      properties: ['openFile', 'multiSelections'] as const,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    }
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled || result.filePaths.length === 0) return []
    return result.filePaths.map((p) => readImageAsDataUrl(p))
  })

  ipcMain.handle('image:getEntryImage', (_event, { imagePath }: { imagePath: string }) => readImageAsDataUrl(imagePath))

  ipcMain.handle('screenshot:capture', () => captureScreenshot())

  // --- Settings ---

  ipcMain.handle('settings:getHotkey', () => getHotkey())
  ipcMain.handle('settings:setHotkey', (_event, { accelerator }: { accelerator: string }) => reregisterHotkey(accelerator))

  ipcMain.handle('settings:getScreenshotHotkey', () => getScreenshotHotkey())
  ipcMain.handle('settings:setScreenshotHotkey', (_event, { accelerator }: { accelerator: string }) => reregisterScreenshotHotkey(accelerator))

  ipcMain.handle('settings:getUploadHotkey', () => getUploadHotkey())
  ipcMain.handle('settings:setUploadHotkey', (_event, { accelerator }: { accelerator: string }) => reregisterUploadHotkey(accelerator))

  // --- Window management ---

  ipcMain.handle('window:openManager', () => showManager())
  ipcMain.handle('overlay:hide', () => hideOverlay())
  ipcMain.handle('window:openDetails', (_event, { id }: { id: string }) => navigateManagerToDetails(id))

  console.log('[ipc] All handlers registered')
}

// Export for use by tray/other non-IPC callers
export { broadcastInvestigationChanged }
