import type { RumourBoard, BoardState, BoardViewport, BoardNode, BoardEdge } from './board-types'
export type { RumourBoard, BoardState, BoardViewport, BoardNode, BoardEdge }

export type ToolType = 'link' | 'string'

export interface Tool {
  id: string
  name: string
  tool_type: ToolType
  value: string
  tags: string[]
  sort_order: number
  created_at: string
  updated_at: string
}

export type EntryType = 'note' | 'action' | 'finding' | 'hypothesis' | 'tool'
export type ExportFormat = 'markdown' | 'pdf' | 'clipboard' | 'rich-clipboard'
export type HypothesisStatus = 'open' | 'true' | 'false' | 'abandoned'
export type ToolEntryStatus = 'pending' | 'done' | 'abandoned'

export interface Investigation {
  id: string
  name: string
  is_active: number // 0 or 1
  created_at: string
  entry_count: number
  last_entry_at: string | null
}

export const MAX_IMAGES_PER_ENTRY = 9
export const MAX_HYPOTHESIS_NESTING_DEPTH = 10

export interface JournalEntry {
  id: string
  investigation_id: string
  body: string
  image_paths: string[]
  created_at: string
  type: EntryType
  hypothesis_status?: HypothesisStatus
  linked_finding_ids?: string[]
  linked_child_hypothesis_ids?: string[]
  parent_hypothesis_ids?: string[]
  action_completed?: boolean
  tool_status?: ToolEntryStatus
  flagged?: boolean
}

export interface ElectronAPI {
  // Investigations
  getActiveInvestigations: () => Promise<Investigation[]>
  listInvestigations: () => Promise<Investigation[]>
  createInvestigation: (name: string) => Promise<Investigation>
  deleteInvestigation: (id: string) => Promise<void>
  setActiveInvestigation: (id: string) => Promise<Investigation>
  deactivateInvestigation: (id: string) => Promise<void>
  renameInvestigation: (id: string, name: string) => Promise<Investigation>

  // Entries
  listEntries: (investigationId: string) => Promise<JournalEntry[]>
  createEntry: (investigationId: string, body: string, imageDataUrls?: string[], type?: EntryType) => Promise<JournalEntry>
  updateEntry: (id: string, body: string, keepImagePaths?: string[] | null, type?: EntryType, newImageDataUrls?: string[]) => Promise<JournalEntry>
  deleteEntry: (id: string) => Promise<void>

  // Actions
  toggleActionCompleted: (entryId: string) => Promise<JournalEntry>

  // Flagging
  toggleFlagged: (entryId: string) => Promise<JournalEntry>

  // Tool entries
  updateToolEntryStatus: (entryId: string, status: ToolEntryStatus) => Promise<JournalEntry>

  // Hypotheses
  updateHypothesisStatus: (entryId: string, status: HypothesisStatus) => Promise<JournalEntry>
  linkHypothesisFinding: (hypothesisId: string, findingId: string) => Promise<JournalEntry>
  unlinkHypothesisFinding: (hypothesisId: string, findingId: string) => Promise<JournalEntry>
  getHypothesisFindings: (hypothesisId: string) => Promise<JournalEntry[]>
  getFindingHypotheses: (findingId: string) => Promise<JournalEntry[]>
  linkHypothesisChild: (parentId: string, childId: string) => Promise<JournalEntry>
  unlinkHypothesisChild: (parentId: string, childId: string) => Promise<JournalEntry>
  getHypothesisNestingDepth: (hypothesisId: string) => Promise<number>

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
    boardIds?: string[]
  }) => Promise<{ success: boolean; error?: string }>

  // Images
  pickImage: () => Promise<string[]>
  captureScreenshot: () => Promise<string | null>
  getEntryImage: (imagePath: string) => Promise<string>
  showImageContextMenu: (imagePath: string) => Promise<void>

  // Settings
  getHotkey: () => Promise<string>
  setHotkey: (accelerator: string) => Promise<boolean>
  getScreenshotHotkey: () => Promise<string>
  setScreenshotHotkey: (accelerator: string) => Promise<boolean>
  getUploadHotkey: () => Promise<string>
  setUploadHotkey: (accelerator: string) => Promise<boolean>
  getLastViewedInvestigationId: () => Promise<string | null>
  setLastViewedInvestigationId: (id: string | null) => Promise<void>
  getMinimapOpen: () => Promise<boolean>
  setMinimapOpen: (open: boolean) => Promise<void>
  getOnboardingDismissed: () => Promise<boolean>
  setOnboardingDismissed: (dismissed: boolean) => Promise<void>
  getAppVersion: () => Promise<string>

  // Window management
  openManager: () => Promise<void>
  hideOverlay: () => Promise<void>
  showOverlay: () => Promise<void>
  expandOverlayForBoard: () => Promise<void>
  restoreOverlayFromBoard: () => Promise<void>
  openDetails: (id: string) => Promise<void>
  onShowDetails: (callback: (id: string) => void) => () => void
  onShowHome: (callback: () => void) => () => void

  // Push events
  onInvestigationChanged: (callback: (investigations: Investigation[]) => void) => () => void
  onEntriesChanged: (callback: (investigationId: string, entries: JournalEntry[]) => void) => () => void
  onTriggerScreenshot: (callback: (dataUrl: string) => void) => () => void
  onTriggerUpload: (callback: () => void) => () => void

  // Screenshot window helpers (used by screenshot renderer)
  onScreenshotData: (callback: (dataUrl: string) => void) => () => void
  sendScreenshotSelection: (rect: { x: number; y: number; width: number; height: number } | null) => void

  // Toolkit
  listTools: () => Promise<Tool[]>
  createTool: (name: string, toolType: ToolType, value: string, tags: string[]) => Promise<Tool>
  createToolsBulk: (tools: { name: string; toolType: ToolType; value: string; tags: string[] }[]) => Promise<Tool[]>
  updateTool: (id: string, name: string, toolType: ToolType, value: string, tags: string[]) => Promise<Tool>
  deleteTool: (id: string) => Promise<void>
  reorderTools: (orderedIds: string[]) => Promise<void>
  executeTool: (id: string) => Promise<void>
  getToolkitHotkey: () => Promise<string>
  setToolkitHotkey: (accelerator: string) => Promise<boolean>
  getManagerHotkey: () => Promise<string>
  setManagerHotkey: (accelerator: string) => Promise<boolean>
  showToolkitOverlay: () => Promise<void>
  hideToolkitOverlay: () => Promise<void>
  onToolsChanged: (callback: (tools: Tool[]) => void) => () => void

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
