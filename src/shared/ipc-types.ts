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
  image_path: string | null
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
  createEntry: (investigationId: string, body: string, imageDataUrl?: string) => Promise<JournalEntry>
  updateEntry: (id: string, body: string, imageDataUrl?: string | null) => Promise<JournalEntry>
  deleteEntry: (id: string) => Promise<void>

  // Images
  pickImage: () => Promise<string | null>
  captureScreenshot: () => Promise<string | null>
  getEntryImage: (imagePath: string) => Promise<string>

  // Settings
  getHotkey: () => Promise<string>
  setHotkey: (accelerator: string) => Promise<boolean>

  // Window management
  openManager: () => Promise<void>
  hideOverlay: () => Promise<void>

  // Push events
  onInvestigationChanged: (callback: (investigation: Investigation | null) => void) => () => void

  // Screenshot window helpers (used by screenshot renderer)
  onScreenshotData: (callback: (dataUrl: string) => void) => () => void
  sendScreenshotSelection: (rect: { x: number; y: number; width: number; height: number } | null) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
