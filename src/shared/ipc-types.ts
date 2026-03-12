export interface Investigation {
  id: string
  name: string
  is_active: number // 0 or 1
  created_at: string
}

export interface JournalEntry {
  id: string
  investigation_id: string
  body: string
  created_at: string
}

export interface ElectronAPI {
  // Investigations
  getActiveInvestigation: () => Promise<Investigation | null>
  listInvestigations: () => Promise<Investigation[]>
  createInvestigation: (name: string) => Promise<Investigation>
  deleteInvestigation: (id: string) => Promise<void>
  setActiveInvestigation: (id: string) => Promise<Investigation>

  // Entries
  listEntries: (investigationId: string) => Promise<JournalEntry[]>
  createEntry: (investigationId: string, body: string) => Promise<JournalEntry>
  updateEntry: (id: string, body: string) => Promise<JournalEntry>
  deleteEntry: (id: string) => Promise<void>

  // Settings
  getHotkey: () => Promise<string>
  setHotkey: (accelerator: string) => Promise<boolean>

  // Window management
  openManager: () => Promise<void>
  hideOverlay: () => Promise<void>

  // Push events
  onInvestigationChanged: (callback: (investigation: Investigation | null) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
