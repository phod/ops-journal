import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, Investigation } from '../shared/ipc-types'

const electronAPI: ElectronAPI = {
  // Investigations
  getActiveInvestigation: () => ipcRenderer.invoke('investigation:getActive'),

  listInvestigations: () => ipcRenderer.invoke('investigation:list'),

  createInvestigation: (name: string) =>
    ipcRenderer.invoke('investigation:create', { name }),

  deleteInvestigation: (id: string) =>
    ipcRenderer.invoke('investigation:delete', { id }),

  setActiveInvestigation: (id: string) =>
    ipcRenderer.invoke('investigation:setActive', { id }),

  // Entries
  listEntries: (investigationId: string) =>
    ipcRenderer.invoke('entry:list', { investigationId }),

  createEntry: (investigationId: string, body: string, imageDataUrl?: string) =>
    ipcRenderer.invoke('entry:create', { investigationId, body, imageDataUrl }),

  updateEntry: (id: string, body: string, imageDataUrl?: string | null) =>
    ipcRenderer.invoke('entry:update', { id, body, imageDataUrl }),

  deleteEntry: (id: string) =>
    ipcRenderer.invoke('entry:delete', { id }),

  // Images
  pickImage: () => ipcRenderer.invoke('image:pick'),

  captureScreenshot: () => ipcRenderer.invoke('screenshot:capture'),

  getEntryImage: (imagePath: string) =>
    ipcRenderer.invoke('image:getEntryImage', { imagePath }),

  // Settings
  getHotkey: () => ipcRenderer.invoke('settings:getHotkey'),
  setHotkey: (accelerator: string) => ipcRenderer.invoke('settings:setHotkey', { accelerator }),

  // Window management
  openManager: () => ipcRenderer.invoke('window:openManager'),

  hideOverlay: () => ipcRenderer.invoke('overlay:hide'),

  // Push events
  onInvestigationChanged: (callback: (investigation: Investigation | null) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, investigation: Investigation | null) => {
      callback(investigation)
    }
    ipcRenderer.on('investigation:changed', listener)
    return () => {
      ipcRenderer.removeListener('investigation:changed', listener)
    }
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
