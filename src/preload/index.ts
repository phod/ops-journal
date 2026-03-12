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

  createEntry: (investigationId: string, body: string) =>
    ipcRenderer.invoke('entry:create', { investigationId, body }),

  updateEntry: (id: string, body: string) =>
    ipcRenderer.invoke('entry:update', { id, body }),

  deleteEntry: (id: string) =>
    ipcRenderer.invoke('entry:delete', { id }),

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
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('investigation:changed', listener)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
