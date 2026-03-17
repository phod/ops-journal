import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, ExportFormat, HypothesisStatus, Investigation, BoardNode, BoardEdge, BoardViewport } from '../shared/ipc-types'

/**
 * Creates a listener for an IPC channel that forwards arguments to a callback,
 * and returns an unsubscribe function.
 */
function onIpcEvent<T extends unknown[]>(
  channel: string,
  callback: (...args: T) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: T): void => callback(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const electronAPI: ElectronAPI = {
  // Investigations
  getActiveInvestigations: () => ipcRenderer.invoke('investigation:getActive'),
  listInvestigations: () => ipcRenderer.invoke('investigation:list'),
  createInvestigation: (name) => ipcRenderer.invoke('investigation:create', { name }),
  deleteInvestigation: (id) => ipcRenderer.invoke('investigation:delete', { id }),
  setActiveInvestigation: (id) => ipcRenderer.invoke('investigation:setActive', { id }),
  deactivateInvestigation: (id) => ipcRenderer.invoke('investigation:deactivate', { id }),

  // Entries
  listEntries: (investigationId) => ipcRenderer.invoke('entry:list', { investigationId }),
  createEntry: (investigationId, body, imageDataUrls, type) =>
    ipcRenderer.invoke('entry:create', { investigationId, body, imageDataUrls, type }),
  updateEntry: (id, body, keepImagePaths, type) =>
    ipcRenderer.invoke('entry:update', { id, body, keepImagePaths, type }),
  deleteEntry: (id) => ipcRenderer.invoke('entry:delete', { id }),

  // Actions
  toggleActionCompleted: (entryId: string) =>
    ipcRenderer.invoke('action:toggleCompleted', { entryId }),

  // Flagging
  toggleFlagged: (entryId: string) =>
    ipcRenderer.invoke('entry:toggleFlagged', { entryId }),

  // Hypotheses
  updateHypothesisStatus: (entryId: string, status: HypothesisStatus) =>
    ipcRenderer.invoke('hypothesis:updateStatus', { entryId, status }),
  linkHypothesisFinding: (hypothesisId: string, findingId: string) =>
    ipcRenderer.invoke('hypothesis:linkFinding', { hypothesisId, findingId }),
  unlinkHypothesisFinding: (hypothesisId: string, findingId: string) =>
    ipcRenderer.invoke('hypothesis:unlinkFinding', { hypothesisId, findingId }),
  getHypothesisFindings: (hypothesisId: string) =>
    ipcRenderer.invoke('hypothesis:getFindings', { hypothesisId }),
  getFindingHypotheses: (findingId: string) =>
    ipcRenderer.invoke('finding:getHypotheses', { findingId }),
  linkHypothesisChild: (parentId: string, childId: string) =>
    ipcRenderer.invoke('hypothesis:linkChild', { parentId, childId }),
  unlinkHypothesisChild: (parentId: string, childId: string) =>
    ipcRenderer.invoke('hypothesis:unlinkChild', { parentId, childId }),
  getHypothesisNestingDepth: (hypothesisId: string) =>
    ipcRenderer.invoke('hypothesis:getNestingDepth', { hypothesisId }),

  // Export
  exportInvestigation: (options: { investigationId: string; investigationName: string; format: ExportFormat; entryIds: string[] }) =>
    ipcRenderer.invoke('investigation:export', options),

  // Summary
  getSummary: (investigationId) => ipcRenderer.invoke('summary:get', { investigationId }),
  saveSummary: (investigationId, summaryJson) => ipcRenderer.invoke('summary:save', { investigationId, summaryJson }),
  saveSummaryImage: (dataUrl) => ipcRenderer.invoke('summary:saveImage', { dataUrl }),

  // Images
  pickImage: () => ipcRenderer.invoke('image:pick') as Promise<string[]>,
  captureScreenshot: () => ipcRenderer.invoke('screenshot:capture'),
  getEntryImage: (imagePath) => ipcRenderer.invoke('image:getEntryImage', { imagePath }),

  // Settings
  getHotkey: () => ipcRenderer.invoke('settings:getHotkey'),
  setHotkey: (accelerator) => ipcRenderer.invoke('settings:setHotkey', { accelerator }),
  getScreenshotHotkey: () => ipcRenderer.invoke('settings:getScreenshotHotkey'),
  setScreenshotHotkey: (accelerator) =>
    ipcRenderer.invoke('settings:setScreenshotHotkey', { accelerator }),
  getUploadHotkey: () => ipcRenderer.invoke('settings:getUploadHotkey'),
  setUploadHotkey: (accelerator) =>
    ipcRenderer.invoke('settings:setUploadHotkey', { accelerator }),
  getLastViewedInvestigationId: () => ipcRenderer.invoke('settings:getLastViewedInvestigationId'),
  setLastViewedInvestigationId: (id) =>
    ipcRenderer.invoke('settings:setLastViewedInvestigationId', { id }),

  // Window management
  openManager: () => ipcRenderer.invoke('window:openManager'),
  hideOverlay: () => ipcRenderer.invoke('overlay:hide'),
  showOverlay: () => ipcRenderer.invoke('overlay:show'),
  expandOverlayForBoard: () => ipcRenderer.invoke('overlay:expandForBoard'),
  restoreOverlayFromBoard: () => ipcRenderer.invoke('overlay:restoreFromBoard'),
  openDetails: (id) => ipcRenderer.invoke('window:openDetails', { id }),
  onShowDetails: (callback) => onIpcEvent<[string]>('navigate:details', callback),
  onShowHome: (callback) => onIpcEvent<[]>('navigate:home', callback),

  // Push events
  onInvestigationChanged: (callback) =>
    onIpcEvent<[Investigation[]]>('investigation:changed', callback),
  onEntriesChanged: (callback) =>
    onIpcEvent<[string, import('../shared/ipc-types').JournalEntry[]]>('entries:changed', callback),
  onTriggerScreenshot: (callback) =>
    onIpcEvent<[string]>('overlay:screenshotCaptured', callback),
  onTriggerUpload: (callback) => onIpcEvent<[]>('overlay:triggerUpload', callback),

  // Screenshot window helpers
  onScreenshotData: (callback) => onIpcEvent<[string]>('screenshot:data', callback),
  sendScreenshotSelection: (rect) => ipcRenderer.send('screenshot:selection', rect),

  // Boards
  listBoards: (investigationId) => ipcRenderer.invoke('board:list', { investigationId }),
  createBoard: (investigationId, name) => ipcRenderer.invoke('board:create', { investigationId, name }),
  deleteBoard: (boardId) => ipcRenderer.invoke('board:delete', { boardId }),
  renameBoard: (boardId, name) => ipcRenderer.invoke('board:rename', { boardId, name }),
  getBoardState: (boardId) => ipcRenderer.invoke('board:getState', { boardId }),
  saveBoardState: (boardId, state: { nodes: BoardNode[]; edges: BoardEdge[]; viewport: BoardViewport }) => ipcRenderer.invoke('board:saveState', { boardId, state }),
  saveBoardImage: (dataUrl) => ipcRenderer.invoke('board:saveImage', { dataUrl })
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
