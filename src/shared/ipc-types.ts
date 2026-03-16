import type { RumourBoard, BoardState, BoardViewport, BoardNode, BoardEdge } from './board-types'
export type { RumourBoard, BoardState, BoardViewport, BoardNode, BoardEdge }

export type EntryType = 'note' | 'action' | 'finding' | 'hypothesis'
export type ExportFormat = 'markdown' | 'pdf' | 'clipboard' | 'rich-clipboard'
export type HypothesisStatus = 'open' | 'true' | 'false' | 'abandoned'

export interface Investigation {
  id: string
  name: string
  is_active: number // 0 or 1
  created_at: string
  entry_count: number
  last_entry_at: string | null
}

export const MAX_IMAGES_PER_ENTRY = 9

export interface JournalEntry {
  id: string
  investigation_id: string
  body: string
  image_paths: string[]
  created_at: string
  type: EntryType
  hypothesis_status?: HypothesisStatus
  linked_finding_ids?: string[]
  action_completed?: boolean
}

export interface ElectronAPI {
  // Investigations
  getActiveInvestigations: () => Promise<Investigation[]>
  listInvestigations: () => Promise<Investigation[]>
  createInvestigation: (name: string) => Promise<Investigation>
  deleteInvestigation: (id: string) => Promise<void>
  setActiveInvestigation: (id: string) => Promise<Investigation>
  deactivateInvestigation: (id: string) => Promise<void>

  // Entries
  listEntries: (investigationId: string) => Promise<JournalEntry[]>
  createEntry: (investigationId: string, body: string, imageDataUrls?: string[], type?: EntryType) => Promise<JournalEntry>
  updateEntry: (id: string, body: string, keepImagePaths?: string[] | null, type?: EntryType) => Promise<JournalEntry>
  deleteEntry: (id: string) => Promise<void>

  // Actions
  toggleActionCompleted: (entryId: string) => Promise<JournalEntry>

  // Hypotheses
  updateHypothesisStatus: (entryId: string, status: HypothesisStatus) => Promise<JournalEntry>
  linkHypothesisFinding: (hypothesisId: string, findingId: string) => Promise<JournalEntry>
  unlinkHypothesisFinding: (hypothesisId: string, findingId: string) => Promise<JournalEntry>
  getHypothesisFindings: (hypothesisId: string) => Promise<JournalEntry[]>
  getFindingHypotheses: (findingId: string) => Promise<JournalEntry[]>

  // Summary
  getSummary: (investigationId: string) => Promise<string | null>
  saveSummary: (investigationId: string, summaryJson: string) => Promise<void>
  saveSummaryImage: (dataUrl: string) => Promise<string>

  // Export
  exportInvestigation: (options: {
    investigationId: string
    investigationName: string
    format: ExportFormat
    entryIds: string[]
    summaryJson?: string
    imageHandling?: 'omit' | 'reference'
    openAfterExport?: boolean
  }) => Promise<{ success: boolean; error?: string }>

  // Images
  pickImage: () => Promise<string[]>
  captureScreenshot: () => Promise<string | null>
  getEntryImage: (imagePath: string) => Promise<string>

  // Settings
  getHotkey: () => Promise<string>
  setHotkey: (accelerator: string) => Promise<boolean>
  getScreenshotHotkey: () => Promise<string>
  setScreenshotHotkey: (accelerator: string) => Promise<boolean>
  getUploadHotkey: () => Promise<string>
  setUploadHotkey: (accelerator: string) => Promise<boolean>

  // Window management
  openManager: () => Promise<void>
  hideOverlay: () => Promise<void>
  showOverlay: () => Promise<void>
  openDetails: (id: string) => Promise<void>
  onShowDetails: (callback: (id: string) => void) => () => void
  onShowHome: (callback: () => void) => () => void

  // Push events
  onInvestigationChanged: (callback: (investigations: Investigation[]) => void) => () => void
  onTriggerScreenshot: (callback: (dataUrl: string) => void) => () => void
  onTriggerUpload: (callback: () => void) => () => void

  // Screenshot window helpers (used by screenshot renderer)
  onScreenshotData: (callback: (dataUrl: string) => void) => () => void
  sendScreenshotSelection: (rect: { x: number; y: number; width: number; height: number } | null) => void

  // Boards
  listBoards: (investigationId: string) => Promise<RumourBoard[]>
  createBoard: (investigationId: string, name?: string) => Promise<RumourBoard>
  deleteBoard: (boardId: string) => Promise<void>
  renameBoard: (boardId: string, name: string) => Promise<RumourBoard>
  getBoardState: (boardId: string) => Promise<BoardState>
  saveBoardState: (boardId: string, state: { nodes: BoardNode[]; edges: BoardEdge[]; viewport: BoardViewport }) => Promise<void>
  saveBoardImage: (dataUrl: string) => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
