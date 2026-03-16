import { ipcMain, BrowserWindow, dialog, clipboard, shell } from 'electron'
import {
  getActiveInvestigations,
  listInvestigations,
  createInvestigation,
  deleteInvestigation,
  setActiveInvestigation,
  deactivateInvestigation,
  getSummary,
  saveSummary
} from './db/investigations'
import { listEntries, createEntry, updateEntry, deleteEntry, getEntry, toggleActionCompleted, updateHypothesisStatus, linkHypothesisFinding, unlinkHypothesisFinding, getHypothesisFindings, getFindingHypotheses, linkHypothesisChild, unlinkHypothesisChild, getHypothesisNestingDepth } from './db/entries'
import { listBoards, createBoard, deleteBoard, renameBoard, getBoardState, saveBoardState } from './db/rumour-boards'
import { getOverlayWindow, showManager, hideOverlay, showOverlay, navigateManagerToDetails } from './windows'
import { reregisterHotkey, reregisterScreenshotHotkey, reregisterUploadHotkey } from './hotkey'
import { getHotkey, getScreenshotHotkey, getUploadHotkey, getLastViewedInvestigationId, setLastViewedInvestigationId } from './settings'
import { saveImage, deleteImage, readImageAsDataUrl } from './images'
import { captureScreenshot } from './screenshot'
import type { Investigation } from '@shared/ipc-types'
import { exportAsMarkdown, exportAsPdf, buildExportHtml } from './export'

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
    (_event, { investigationId, body, imageDataUrls, type }: { investigationId: string; body: string; imageDataUrls?: string[]; type?: import('@shared/ipc-types').EntryType }) => {
      const imagePaths = (imageDataUrls ?? []).map((dataUrl) => saveImage(dataUrlToBuffer(dataUrl)))
      return createEntry(investigationId, body, imagePaths, type)
    }
  )

  ipcMain.handle('entry:update', (_event, { id, body, keepImagePaths, type }: { id: string; body: string; keepImagePaths?: string[] | null; type?: import('@shared/ipc-types').EntryType }) => {
    const existingPaths = getEntry(id)?.image_paths ?? []

    if (keepImagePaths !== undefined) {
      const pathsToKeep = keepImagePaths ?? []
      for (const p of existingPaths) {
        if (!pathsToKeep.includes(p)) deleteImage(p)
      }
    }

    return updateEntry(id, body, keepImagePaths, type)
  })

  ipcMain.handle('entry:delete', (_event, { id }: { id: string }) => {
    const entry = deleteEntry(id)
    for (const p of entry?.image_paths ?? []) deleteImage(p)
  })

  // --- Actions ---

  ipcMain.handle('action:toggleCompleted', (_event, { entryId }: { entryId: string }) => {
    return toggleActionCompleted(entryId)
  })

  // --- Hypotheses ---

  ipcMain.handle('hypothesis:updateStatus', (_event, { entryId, status }: { entryId: string; status: import('@shared/ipc-types').HypothesisStatus }) => {
    return updateHypothesisStatus(entryId, status)
  })

  ipcMain.handle('hypothesis:linkFinding', (_event, { hypothesisId, findingId }: { hypothesisId: string; findingId: string }) => {
    return linkHypothesisFinding(hypothesisId, findingId)
  })

  ipcMain.handle('hypothesis:unlinkFinding', (_event, { hypothesisId, findingId }: { hypothesisId: string; findingId: string }) => {
    return unlinkHypothesisFinding(hypothesisId, findingId)
  })

  ipcMain.handle('hypothesis:getFindings', (_event, { hypothesisId }: { hypothesisId: string }) => {
    return getHypothesisFindings(hypothesisId)
  })

  ipcMain.handle('finding:getHypotheses', (_event, { findingId }: { findingId: string }) => {
    return getFindingHypotheses(findingId)
  })

  ipcMain.handle('hypothesis:linkChild', (_event, { parentId, childId }: { parentId: string; childId: string }) => {
    return linkHypothesisChild(parentId, childId)
  })

  ipcMain.handle('hypothesis:unlinkChild', (_event, { parentId, childId }: { parentId: string; childId: string }) => {
    return unlinkHypothesisChild(parentId, childId)
  })

  ipcMain.handle('hypothesis:getNestingDepth', (_event, { hypothesisId }: { hypothesisId: string }) => {
    return getHypothesisNestingDepth(hypothesisId)
  })

  // --- Summary ---

  ipcMain.handle('summary:get', (_event, { investigationId }: { investigationId: string }) => getSummary(investigationId))

  ipcMain.handle('summary:save', (_event, { investigationId, summaryJson }: { investigationId: string; summaryJson: string }) => saveSummary(investigationId, summaryJson))

  ipcMain.handle('summary:saveImage', (_event, { dataUrl }: { dataUrl: string }) => saveImage(dataUrlToBuffer(dataUrl)))

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

  // --- Export ---

  ipcMain.handle(
    'investigation:export',
    async (
      _event,
      {
        investigationId,
        investigationName,
        format,
        entryIds,
        summaryJson,
        imageHandling = 'omit',
        openAfterExport = false
      }: { investigationId: string; investigationName: string; format: 'markdown' | 'pdf' | 'clipboard' | 'rich-clipboard'; entryIds: string[]; summaryJson?: string; imageHandling?: 'omit' | 'reference'; openAfterExport?: boolean }
    ) => {
      try {
        const allEntries = listEntries(investigationId)
        const entries = allEntries.filter((e) => entryIds.includes(e.id))
        const investigations = listInvestigations()
        const investigation = investigations.find((i) => i.id === investigationId)
        const createdAt = investigation?.created_at ?? new Date().toISOString()

        if (format === 'clipboard') {
          const md = exportAsMarkdown(investigationName, createdAt, entries, summaryJson, imageHandling)
          clipboard.writeText(md)
          return { success: true }
        }

        if (format === 'rich-clipboard') {
          const md = exportAsMarkdown(investigationName, createdAt, entries, summaryJson, 'omit')
          const html = buildExportHtml(investigationName, createdAt, entries, summaryJson)
          clipboard.write({ text: md, html })
          return { success: true }
        }

        const ext = format === 'pdf' ? 'pdf' : 'md'
        const defaultName = `${investigationName.replace(/[^a-z0-9]/gi, '_')}.${ext}`
        const focusedWindow = BrowserWindow.getFocusedWindow()
        const dialogResult = focusedWindow
          ? await dialog.showSaveDialog(focusedWindow, { defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
          : await dialog.showSaveDialog({ defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })

        if (dialogResult.canceled || !dialogResult.filePath) return { success: false, error: 'Cancelled' }

        if (format === 'pdf') {
          await exportAsPdf(investigationName, createdAt, entries, dialogResult.filePath, summaryJson)
        } else {
          const md = exportAsMarkdown(investigationName, createdAt, entries, summaryJson, imageHandling)
          const { writeFileSync } = await import('fs')
          writeFileSync(dialogResult.filePath, md, 'utf-8')
        }

        if (openAfterExport) shell.openPath(dialogResult.filePath)

        return { success: true }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  // --- Boards ---

  ipcMain.handle('board:list', (_event, { investigationId }: { investigationId: string }) => listBoards(investigationId))

  ipcMain.handle('board:create', (_event, { investigationId, name }: { investigationId: string; name?: string }) => createBoard(investigationId, name))

  ipcMain.handle('board:delete', (_event, { boardId }: { boardId: string }) => deleteBoard(boardId))

  ipcMain.handle('board:rename', (_event, { boardId, name }: { boardId: string; name: string }) => renameBoard(boardId, name))

  ipcMain.handle('board:getState', (_event, { boardId }: { boardId: string }) => getBoardState(boardId))

  ipcMain.handle('board:saveState', (_event, { boardId, state }: { boardId: string; state: Parameters<typeof saveBoardState>[1] }) => saveBoardState(boardId, state))

  ipcMain.handle('board:saveImage', (_event, { dataUrl }: { dataUrl: string }) => saveImage(dataUrlToBuffer(dataUrl)))

  // --- Settings ---

  ipcMain.handle('settings:getHotkey', () => getHotkey())
  ipcMain.handle('settings:setHotkey', (_event, { accelerator }: { accelerator: string }) => reregisterHotkey(accelerator))

  ipcMain.handle('settings:getScreenshotHotkey', () => getScreenshotHotkey())
  ipcMain.handle('settings:setScreenshotHotkey', (_event, { accelerator }: { accelerator: string }) => reregisterScreenshotHotkey(accelerator))

  ipcMain.handle('settings:getUploadHotkey', () => getUploadHotkey())
  ipcMain.handle('settings:setUploadHotkey', (_event, { accelerator }: { accelerator: string }) => reregisterUploadHotkey(accelerator))

  ipcMain.handle('settings:getLastViewedInvestigationId', () => getLastViewedInvestigationId())
  ipcMain.handle('settings:setLastViewedInvestigationId', (_event, { id }: { id: string | null }) => setLastViewedInvestigationId(id))

  // --- Window management ---

  ipcMain.handle('window:openManager', () => showManager())
  ipcMain.handle('overlay:hide', () => hideOverlay())
  ipcMain.handle('overlay:show', () => showOverlay())
  ipcMain.handle('window:openDetails', (_event, { id }: { id: string }) => navigateManagerToDetails(id))

  console.log('[ipc] All handlers registered')
}

// Export for use by tray/other non-IPC callers
export { broadcastInvestigationChanged }
