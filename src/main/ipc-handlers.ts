import { ipcMain, BrowserWindow } from 'electron'
import {
  getActiveInvestigation,
  listInvestigations,
  createInvestigation,
  deleteInvestigation,
  setActiveInvestigation
} from './db/investigations'
import { listEntries, createEntry, updateEntry, deleteEntry } from './db/entries'
import { getOverlayWindow, getManagerWindow, showManager, hideOverlay } from './windows'
import { reregisterHotkey } from './hotkey'
import { getHotkey } from './settings'
import type { Investigation } from '@shared/ipc-types'

function broadcastInvestigationChanged(investigation: Investigation | null): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('investigation:changed', investigation)
    }
  }
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
    (_event, { investigationId, body }: { investigationId: string; body: string }) => {
      return createEntry(investigationId, body)
    }
  )

  ipcMain.handle('entry:update', (_event, { id, body }: { id: string; body: string }) => {
    return updateEntry(id, body)
  })

  ipcMain.handle('entry:delete', (_event, { id }: { id: string }) => {
    deleteEntry(id)
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
