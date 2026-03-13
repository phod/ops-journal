import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, Investigation } from '../shared/ipc-types'

const electronAPI: ElectronAPI = {
  // Investigations
  getActiveInvestigations: () => ipcRenderer.invoke('investigation:getActive'),

  listInvestigations: () => ipcRenderer.invoke('investigation:list'),

  createInvestigation: (name: string) =>
    ipcRenderer.invoke('investigation:create', { name }),

  deleteInvestigation: (id: string) =>
    ipcRenderer.invoke('investigation:delete', { id }),

  setActiveInvestigation: (id: string) =>
    ipcRenderer.invoke('investigation:setActive', { id }),

  deactivateInvestigation: (id: string) =>
    ipcRenderer.invoke('investigation:deactivate', { id }),

  // Entries
  listEntries: (investigationId: string) =>
    ipcRenderer.invoke('entry:list', { investigationId }),

  createEntry: (investigationId: string, body: string, imageDataUrls?: string[]) =>
    ipcRenderer.invoke('entry:create', { investigationId, body, imageDataUrls }),

  updateEntry: (id: string, body: string, keepImagePaths?: string[] | null) =>
    ipcRenderer.invoke('entry:update', { id, body, keepImagePaths }),

  deleteEntry: (id: string) =>
    ipcRenderer.invoke('entry:delete', { id }),

  // Images
  pickImage: () => ipcRenderer.invoke('image:pick') as Promise<string[]>,

  captureScreenshot: () => ipcRenderer.invoke('screenshot:capture'),

  getEntryImage: (imagePath: string) =>
    ipcRenderer.invoke('image:getEntryImage', { imagePath }),

  // Settings
  getHotkey: () => ipcRenderer.invoke('settings:getHotkey'),
  setHotkey: (accelerator: string) => ipcRenderer.invoke('settings:setHotkey', { accelerator }),
  getScreenshotHotkey: () => ipcRenderer.invoke('settings:getScreenshotHotkey'),
  setScreenshotHotkey: (accelerator: string) => ipcRenderer.invoke('settings:setScreenshotHotkey', { accelerator }),
  getUploadHotkey: () => ipcRenderer.invoke('settings:getUploadHotkey'),
  setUploadHotkey: (accelerator: string) => ipcRenderer.invoke('settings:setUploadHotkey', { accelerator }),

  // Window management
  openManager: () => ipcRenderer.invoke('window:openManager'),

  hideOverlay: () => ipcRenderer.invoke('overlay:hide'),

  openDetails: (id: string) => ipcRenderer.invoke('window:openDetails', { id }),

  onShowDetails: (callback: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) => callback(id)
    ipcRenderer.on('navigate:details', listener)
    return () => ipcRenderer.removeListener('navigate:details', listener)
  },

  // Push events
  onInvestigationChanged: (callback: (investigations: Investigation[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, investigations: Investigation[]) => {
      callback(investigations)
    }
    ipcRenderer.on('investigation:changed', listener)
    return () => {
      ipcRenderer.removeListener('investigation:changed', listener)
    }
  },

  // Image hotkey push events
  onTriggerScreenshot: (callback: (dataUrl: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, dataUrl: string) => callback(dataUrl)
    ipcRenderer.on('overlay:screenshotCaptured', listener)
    return () => ipcRenderer.removeListener('overlay:screenshotCaptured', listener)
  },

  onTriggerUpload: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('overlay:triggerUpload', listener)
    return () => ipcRenderer.removeListener('overlay:triggerUpload', listener)
  },

  // Screenshot window helpers
  onScreenshotData: (callback: (dataUrl: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, dataUrl: string) => {
      callback(dataUrl)
    }
    ipcRenderer.on('screenshot:data', listener)
    return () => {
      ipcRenderer.removeListener('screenshot:data', listener)
    }
  },

  sendScreenshotSelection: (rect: { x: number; y: number; width: number; height: number } | null) => {
    ipcRenderer.send('screenshot:selection', rect)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
