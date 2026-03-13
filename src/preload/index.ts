import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, Investigation } from '../shared/ipc-types'

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
  createEntry: (investigationId, body, imageDataUrls) =>
    ipcRenderer.invoke('entry:create', { investigationId, body, imageDataUrls }),
  updateEntry: (id, body, keepImagePaths) =>
    ipcRenderer.invoke('entry:update', { id, body, keepImagePaths }),
  deleteEntry: (id) => ipcRenderer.invoke('entry:delete', { id }),

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

  // Window management
  openManager: () => ipcRenderer.invoke('window:openManager'),
  hideOverlay: () => ipcRenderer.invoke('overlay:hide'),
  openDetails: (id) => ipcRenderer.invoke('window:openDetails', { id }),
  onShowDetails: (callback) => onIpcEvent<[string]>('navigate:details', callback),

  // Push events
  onInvestigationChanged: (callback) =>
    onIpcEvent<[Investigation[]]>('investigation:changed', callback),
  onTriggerScreenshot: (callback) =>
    onIpcEvent<[string]>('overlay:screenshotCaptured', callback),
  onTriggerUpload: (callback) => onIpcEvent<[]>('overlay:triggerUpload', callback),

  // Screenshot window helpers
  onScreenshotData: (callback) => onIpcEvent<[string]>('screenshot:data', callback),
  sendScreenshotSelection: (rect) => ipcRenderer.send('screenshot:selection', rect)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
