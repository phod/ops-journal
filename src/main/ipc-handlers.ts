import { app, ipcMain, BrowserWindow, dialog, clipboard, shell, Menu, nativeImage } from 'electron'
import {
  getActiveInvestigations,
  listInvestigations,
  createInvestigation,
  deleteInvestigation,
  setActiveInvestigation,
  deactivateInvestigation,
  renameInvestigation,
  reorderInvestigations,
  getSummary,
  saveSummary
} from './db/investigations'
import { listEntries, createEntry, updateEntry, deleteEntry, getEntry, toggleActionCompleted, toggleFlagged, updateHypothesisStatus, updateToolEntryStatus, linkHypothesisFinding, unlinkHypothesisFinding, linkHypothesisAction, unlinkHypothesisAction, getHypothesisFindings, getFindingHypotheses, linkHypothesisChild, unlinkHypothesisChild, getHypothesisNestingDepth, listPendingToolEntries } from './db/entries'
import { listBoards, createBoard, deleteBoard, renameBoard, getBoardState, saveBoardState } from './db/rumour-boards'
import { listTools, createTool, createToolsBulk, updateTool, deleteTool, reorderTools, moveToolToFolder, moveToolsToFolder, reorderToolsInFolder } from './db/tools'
import { listToolFolders, createToolFolder, renameToolFolder, deleteToolFolder, moveToolFolderToFolder, reorderToolFoldersInParent } from './db/tool-folders'
import { createReminder, getReminder, listReminders as listAllReminders, rescheduleReminder, completeReminder, dismissReminder, deleteReminder } from './db/reminders'
import { getOverlayWindow, showManager, hideOverlay, showOverlay, navigateManagerToDetails, expandOverlayForBoard, restoreOverlayFromBoard, expandOverlayForSearch, restoreOverlayFromSearch, showToolkitOverlay, hideToolkitOverlay, getToolkitOverlayWindow, getPreviousFrontApp } from './windows'
import { reregisterHotkey, reregisterScreenshotHotkey, reregisterUploadHotkey, reregisterToolkitHotkey, reregisterManagerHotkey } from './hotkey'
import { getHotkey, getScreenshotHotkey, getUploadHotkey, getToolkitHotkey, getManagerHotkey, getLastViewedInvestigationId, setLastViewedInvestigationId, getMinimapOpen, setMinimapOpen, getOnboardingDismissed, setOnboardingDismissed, getOpaqueOverlay, setOpaqueOverlay } from './settings'
import { saveImage, deleteImage, readImageAsDataUrl } from './images'
import { captureScreenshot } from './screenshot'
import type { Investigation, Tool, ToolFolder, ToolType, FunctionParameter, Reminder } from '@shared/ipc-types'
import { rescheduleNextReminder } from './reminder-scheduler'
import { exportAsMarkdown, exportAsPdf, buildExportHtml } from './export'
import { interpretScript } from './script-interpreter'

function broadcastInvestigationChanged(investigations: Investigation[]): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('investigation:changed', investigations)
    }
  }
}

function broadcastToolsChanged(): void {
  const tools = listTools()
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('tools:changed', tools)
    }
  }
}

function broadcastToolFoldersChanged(): void {
  const folders = listToolFolders()
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('toolFolders:changed', folders)
    }
  }
}

function broadcastEntriesChanged(investigationId: string): void {
  const entries = listEntries(investigationId)
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('entries:changed', investigationId, entries)
    }
  }
}

function broadcastRemindersChanged(): void {
  const reminders = listAllReminders()
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('reminders:changed', reminders)
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

  ipcMain.handle('investigation:rename', (_event, { id, name }: { id: string; name: string }) => {
    const investigation = renameInvestigation(id, name)
    broadcastInvestigationChanged(getActiveInvestigations())
    return investigation
  })

  ipcMain.handle('investigation:reorder', (_event, { orderedIds }: { orderedIds: string[] }) => {
    reorderInvestigations(orderedIds)
    broadcastInvestigationChanged(getActiveInvestigations())
  })

  // --- Entries ---

  ipcMain.handle('entry:list', (_event, { investigationId }: { investigationId: string }) => listEntries(investigationId))

  ipcMain.handle(
    'entry:create',
    (_event, { investigationId, body, imageDataUrls, type }: { investigationId: string; body: string; imageDataUrls?: string[]; type?: import('@shared/ipc-types').EntryType }) => {
      const imagePaths = (imageDataUrls ?? []).map((dataUrl) => saveImage(dataUrlToBuffer(dataUrl)))
      const entry = createEntry(investigationId, body, imagePaths, type)
      broadcastEntriesChanged(investigationId)
      return entry
    }
  )

  ipcMain.handle('entry:update', (_event, { id, body, keepImagePaths, type, newImageDataUrls }: { id: string; body: string; keepImagePaths?: string[] | null; type?: import('@shared/ipc-types').EntryType; newImageDataUrls?: string[] }) => {
    const existingPaths = getEntry(id)?.image_paths ?? []

    if (keepImagePaths !== undefined) {
      const pathsToKeep = keepImagePaths ?? []
      for (const p of existingPaths) {
        if (!pathsToKeep.includes(p)) deleteImage(p)
      }
    }

    const newImagePaths = (newImageDataUrls ?? []).map((dataUrl) => saveImage(dataUrlToBuffer(dataUrl)))
    const updated = updateEntry(id, body, keepImagePaths, type, newImagePaths)
    broadcastEntriesChanged(updated.investigation_id)
    return updated
  })

  ipcMain.handle('entry:delete', (_event, { id }: { id: string }) => {
    const entry = deleteEntry(id)
    if (entry) {
      for (const p of entry.image_paths) deleteImage(p)
      broadcastEntriesChanged(entry.investigation_id)
    }
  })

  // --- Actions ---

  ipcMain.handle('action:toggleCompleted', (_event, { entryId }: { entryId: string }) => {
    const entry = toggleActionCompleted(entryId)
    if (entry) broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  // --- Flagging ---

  ipcMain.handle('entry:toggleFlagged', (_event, { entryId }: { entryId: string }) => {
    const entry = toggleFlagged(entryId)
    if (entry) broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  // --- Tool entries ---

  ipcMain.handle('toolEntry:updateStatus', (_event, { entryId, status }: { entryId: string; status: import('@shared/ipc-types').ToolEntryStatus }) => {
    const entry = updateToolEntryStatus(entryId, status)
    broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  ipcMain.handle('toolEntry:listPending', (_event, { investigationId, statuses }: { investigationId?: string; statuses?: import('@shared/ipc-types').ToolEntryStatus[] }) => {
    return listPendingToolEntries(investigationId, statuses)
  })

  ipcMain.handle('toolEntry:createFromEntry', (_event, { entryId, name, toolType, value, tags, parameters, folderId }: { entryId: string; name: string; toolType: ToolType; value: string; tags: string[]; parameters?: FunctionParameter[] | null; folderId?: string | null }) => {
    const tool = createTool(name, toolType, value, tags, folderId, parameters)
    const entry = updateToolEntryStatus(entryId, 'done')
    broadcastToolsChanged()
    broadcastEntriesChanged(entry.investigation_id)
    return tool
  })

  ipcMain.handle('toolEntry:abandon', (_event, { entryId }: { entryId: string }) => {
    const entry = updateToolEntryStatus(entryId, 'abandoned')
    broadcastEntriesChanged(entry.investigation_id)
  })

  // --- Hypotheses ---

  ipcMain.handle('hypothesis:updateStatus', (_event, { entryId, status }: { entryId: string; status: import('@shared/ipc-types').HypothesisStatus }) => {
    const entry = updateHypothesisStatus(entryId, status)
    broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  ipcMain.handle('hypothesis:linkFinding', (_event, { hypothesisId, findingId }: { hypothesisId: string; findingId: string }) => {
    const entry = linkHypothesisFinding(hypothesisId, findingId)
    broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  ipcMain.handle('hypothesis:unlinkFinding', (_event, { hypothesisId, findingId }: { hypothesisId: string; findingId: string }) => {
    const entry = unlinkHypothesisFinding(hypothesisId, findingId)
    broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  ipcMain.handle('hypothesis:linkAction', (_event, { hypothesisId, actionId }: { hypothesisId: string; actionId: string }) => {
    const entry = linkHypothesisAction(hypothesisId, actionId)
    broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  ipcMain.handle('hypothesis:unlinkAction', (_event, { hypothesisId, actionId }: { hypothesisId: string; actionId: string }) => {
    const entry = unlinkHypothesisAction(hypothesisId, actionId)
    broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  ipcMain.handle('hypothesis:getFindings', (_event, { hypothesisId }: { hypothesisId: string }) => {
    return getHypothesisFindings(hypothesisId)
  })

  ipcMain.handle('finding:getHypotheses', (_event, { findingId }: { findingId: string }) => {
    return getFindingHypotheses(findingId)
  })

  ipcMain.handle('hypothesis:linkChild', (_event, { parentId, childId }: { parentId: string; childId: string }) => {
    const entry = linkHypothesisChild(parentId, childId)
    broadcastEntriesChanged(entry.investigation_id)
    return entry
  })

  ipcMain.handle('hypothesis:unlinkChild', (_event, { parentId, childId }: { parentId: string; childId: string }) => {
    const entry = unlinkHypothesisChild(parentId, childId)
    broadcastEntriesChanged(entry.investigation_id)
    return entry
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

  ipcMain.handle('image:contextMenu', (event, { imagePath }: { imagePath: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const menu = Menu.buildFromTemplate([
      {
        label: 'Copy Image',
        click: () => {
          const img = nativeImage.createFromPath(imagePath)
          clipboard.writeImage(img)
        }
      },
      {
        label: 'Open Image',
        click: () => {
          shell.openPath(imagePath)
        }
      },
      {
        label: 'Show in Folder',
        click: () => {
          shell.showItemInFolder(imagePath)
        }
      }
    ])
    menu.popup({ window: win })
  })

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
        openAfterExport = false,
        boardIds
      }: { investigationId: string; investigationName: string; format: 'markdown' | 'pdf' | 'clipboard' | 'rich-clipboard'; entryIds: string[]; summaryJson?: string; imageHandling?: 'omit' | 'reference'; openAfterExport?: boolean; boardIds?: string[] }
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
          const boardStates = boardIds && boardIds.length > 0
            ? boardIds.map((id) => getBoardState(id))
            : undefined
          await exportAsPdf(investigationName, createdAt, entries, dialogResult.filePath, summaryJson, boardStates, allEntries)
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

  ipcMain.handle('settings:getMinimapOpen', () => getMinimapOpen())
  ipcMain.handle('settings:setMinimapOpen', (_event, { open }: { open: boolean }) => setMinimapOpen(open))

  ipcMain.handle('settings:getOnboardingDismissed', () => getOnboardingDismissed())
  ipcMain.handle('settings:setOnboardingDismissed', (_event, { dismissed }: { dismissed: boolean }) => {
    setOnboardingDismissed(dismissed)
    if (!dismissed) {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('onboarding:reset')
      }
    }
  })
  ipcMain.handle('settings:getOpaqueOverlay', () => getOpaqueOverlay())
  ipcMain.handle('settings:setOpaqueOverlay', (_event, { opaque }: { opaque: boolean }) => {
    setOpaqueOverlay(opaque)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('settings:opaqueOverlayChanged', opaque)
    }
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())

  // --- Tools ---

  ipcMain.handle('tool:list', () => listTools())

  ipcMain.handle('tool:create', (_event, { name, toolType, value, tags, folderId, parameters }: { name: string; toolType: ToolType; value: string; tags: string[]; folderId?: string | null; parameters?: FunctionParameter[] | null }) => {
    const tool = createTool(name, toolType, value, tags, folderId, parameters)
    broadcastToolsChanged()
    return tool
  })

  ipcMain.handle('tool:createBulk', (_event, { tools, folderId }: { tools: { name: string; toolType: ToolType; value: string; tags: string[]; parameters?: FunctionParameter[] | null }[]; folderId?: string | null }) => {
    const created = createToolsBulk(tools, folderId)
    broadcastToolsChanged()
    return created
  })

  ipcMain.handle('tool:update', (_event, { id, name, toolType, value, tags, parameters }: { id: string; name: string; toolType: ToolType; value: string; tags: string[]; parameters?: FunctionParameter[] | null }) => {
    const tool = updateTool(id, name, toolType, value, tags, parameters)
    broadcastToolsChanged()
    return tool
  })

  ipcMain.handle('tool:delete', (_event, { id }: { id: string }) => {
    deleteTool(id)
    broadcastToolsChanged()
  })

  ipcMain.handle('tool:reorder', (_event, { orderedIds }: { orderedIds: string[] }) => {
    reorderTools(orderedIds)
    broadcastToolsChanged()
  })

  ipcMain.handle('tool:moveToFolder', (_event, { toolId, folderId }: { toolId: string; folderId: string | null }) => {
    moveToolToFolder(toolId, folderId)
    broadcastToolsChanged()
  })

  ipcMain.handle('tool:moveMultipleToFolder', (_event, { toolIds, folderId }: { toolIds: string[]; folderId: string | null }) => {
    moveToolsToFolder(toolIds, folderId)
    broadcastToolsChanged()
  })

  ipcMain.handle('tool:reorderInFolder', (_event, { folderId, orderedIds }: { folderId: string | null; orderedIds: string[] }) => {
    reorderToolsInFolder(folderId, orderedIds)
    broadcastToolsChanged()
  })

  ipcMain.handle('tool:execute', async (_event, { id }: { id: string }) => {
    const tools = listTools()
    const tool = tools.find((t) => t.id === id)
    if (!tool) return

    if (tool.tool_type === 'content' || tool.tool_type === 'reference') {
      // Content and reference tools are displayed entirely in the renderer
      return
    }

    if (tool.tool_type === 'link') {
      shell.openExternal(tool.value)
    } else {
      clipboard.writeText(tool.value)
      const frontApp = await getPreviousFrontApp()
      console.log('[tool:execute] Previous front app:', frontApp)
      hideToolkitOverlay()
      await new Promise((r) => setTimeout(r, 150))
      try {
        const { execSync } = require('child_process')
        if (frontApp) {
          execSync(
            `osascript -e 'tell application "${frontApp}" to activate' -e 'delay 0.1' -e 'tell application "System Events" to keystroke "v" using command down'`
          )
        } else {
          execSync('osascript -e \'tell application "System Events" to keystroke "v" using command down\'')
        }
      } catch {
        // Paste simulation failed — text is still on clipboard
      }
    }
  })

  ipcMain.handle('tool:executeFunction', async (_event, { id, paramValues }: { id: string; paramValues: Record<string, string> }) => {
    const tools = listTools()
    const tool = tools.find((t) => t.id === id)
    if (!tool || tool.tool_type !== 'function') return

    console.log('[tool:executeFunction] paramValues:', paramValues)
    const actions = interpretScript(tool.value, paramValues)
    console.log('[tool:executeFunction] actions:', actions)
    for (const action of actions) {
      if (action.type === 'copy') {
        console.log('[tool:executeFunction] copying:', action.value)
        clipboard.writeText(action.value)
      } else if (action.type === 'openLink') {
        console.log('[tool:executeFunction] opening:', action.value)
        await shell.openExternal(action.value)
      }
    }
  })

  // --- Tool Folders ---

  ipcMain.handle('toolFolder:list', () => listToolFolders())

  ipcMain.handle('toolFolder:create', (_event, { name, parentId }: { name: string; parentId?: string | null }) => {
    const folder = createToolFolder(name, parentId)
    broadcastToolFoldersChanged()
    return folder
  })

  ipcMain.handle('toolFolder:rename', (_event, { id, name }: { id: string; name: string }) => {
    const folder = renameToolFolder(id, name)
    broadcastToolFoldersChanged()
    return folder
  })

  ipcMain.handle('toolFolder:delete', (_event, { id }: { id: string }) => {
    deleteToolFolder(id)
    broadcastToolFoldersChanged()
    broadcastToolsChanged()
  })

  ipcMain.handle('toolFolder:moveToFolder', (_event, { folderId, parentId }: { folderId: string; parentId: string | null }) => {
    moveToolFolderToFolder(folderId, parentId)
    broadcastToolFoldersChanged()
  })

  ipcMain.handle('toolFolder:reorderInParent', (_event, { parentId, orderedIds }: { parentId: string | null; orderedIds: string[] }) => {
    reorderToolFoldersInParent(parentId, orderedIds)
    broadcastToolFoldersChanged()
  })

  // --- Toolkit overlay ---

  ipcMain.handle('settings:getToolkitHotkey', () => getToolkitHotkey())
  ipcMain.handle('settings:setToolkitHotkey', (_event, { accelerator }: { accelerator: string }) => reregisterToolkitHotkey(accelerator))

  ipcMain.handle('settings:getManagerHotkey', () => getManagerHotkey())
  ipcMain.handle('settings:setManagerHotkey', (_event, { accelerator }: { accelerator: string }) => reregisterManagerHotkey(accelerator))

  ipcMain.handle('toolkitOverlay:show', () => showToolkitOverlay())
  ipcMain.handle('toolkitOverlay:hide', () => hideToolkitOverlay())

  // --- Window management ---

  ipcMain.handle('window:openManager', () => showManager())
  ipcMain.handle('overlay:hide', () => hideOverlay())
  ipcMain.handle('overlay:show', () => showOverlay())
  ipcMain.handle('overlay:expandForBoard', () => expandOverlayForBoard())
  ipcMain.handle('overlay:restoreFromBoard', () => restoreOverlayFromBoard())
  ipcMain.handle('overlay:expandForSearch', () => expandOverlayForSearch())
  ipcMain.handle('overlay:restoreFromSearch', () => restoreOverlayFromSearch())
  ipcMain.handle('window:openDetails', (_event, { id }: { id: string }) => navigateManagerToDetails(id))

  // --- Reminders ---

  ipcMain.handle('reminder:create', (_event, { entryId, dueAt, note }: { entryId: string; dueAt: string; note?: string }) => {
    const reminder = createReminder(entryId, dueAt, note)
    broadcastRemindersChanged()
    broadcastEntriesChanged(reminder.investigation_id)
    rescheduleNextReminder()
    return reminder
  })

  ipcMain.handle('reminder:list', () => listAllReminders())

  ipcMain.handle('reminder:reschedule', (_event, { id, dueAt, note }: { id: string; dueAt: string; note?: string }) => {
    const reminder = rescheduleReminder(id, dueAt, note)
    broadcastRemindersChanged()
    broadcastEntriesChanged(reminder.investigation_id)
    rescheduleNextReminder()
    return reminder
  })

  ipcMain.handle('reminder:complete', (_event, { id }: { id: string }) => {
    const reminder = completeReminder(id)
    broadcastRemindersChanged()
    broadcastEntriesChanged(reminder.investigation_id)
    return reminder
  })

  ipcMain.handle('reminder:dismiss', (_event, { id }: { id: string }) => {
    const existing = getReminder(id)
    dismissReminder(id)
    broadcastRemindersChanged()
    if (existing) {
      broadcastEntriesChanged(existing.investigation_id)
    }
  })

  ipcMain.handle('reminder:delete', (_event, { id }: { id: string }) => {
    const existing = getReminder(id)
    deleteReminder(id)
    broadcastRemindersChanged()
    if (existing) {
      broadcastEntriesChanged(existing.investigation_id)
    }
  })

  // --- Shell ---

  ipcMain.handle('shell:openExternal', (_event, { url }: { url: string }) => shell.openExternal(url))

  console.log('[ipc] All handlers registered')
}

// Export for use by tray/other non-IPC callers
export { broadcastInvestigationChanged }
