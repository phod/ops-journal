import type { RumourBoard, BoardState, BoardViewport, BoardNode, BoardEdge } from './board-types'
export type { RumourBoard, BoardState, BoardViewport, BoardNode, BoardEdge }

export type ToolType = 'link' | 'string' | 'function'

export type FunctionParameterType = 'text' | 'list' | 'list-other'

export interface FunctionParameter {
  name: string
  type: FunctionParameterType
  options?: string[]
}

export interface Tool {
  id: string
  name: string
  tool_type: ToolType
  value: string
  tags: string[]
  folder_id: string | null
  sort_order: number
  parameters: FunctionParameter[] | null
  created_at: string
  updated_at: string
}

export interface ToolFolder {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export const MAX_TOOL_FOLDER_DEPTH = 4

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
  linked_action_ids?: string[]
  linked_child_hypothesis_ids?: string[]
  parent_hypothesis_ids?: string[]
  action_completed?: boolean
  tool_status?: ToolEntryStatus
  flagged?: boolean
}

export interface PendingToolEntry {
  id: string
  investigation_id: string
  investigation_name: string
  body: string
  created_at: string
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
  listPendingToolEntries: (investigationId?: string) => Promise<PendingToolEntry[]>
  createToolFromEntry: (entryId: string, name: string, toolType: ToolType, value: string, tags: string[]) => Promise<Tool>
  abandonToolEntry: (entryId: string) => Promise<void>

  // Hypotheses
  updateHypothesisStatus: (entryId: string, status: HypothesisStatus) => Promise<JournalEntry>
  linkHypothesisFinding: (hypothesisId: string, findingId: string) => Promise<JournalEntry>
  unlinkHypothesisFinding: (hypothesisId: string, findingId: string) => Promise<JournalEntry>
  linkHypothesisAction: (hypothesisId: string, actionId: string) => Promise<JournalEntry>
  unlinkHypothesisAction: (hypothesisId: string, actionId: string) => Promise<JournalEntry>
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
  getOpaqueOverlay: () => Promise<boolean>
  setOpaqueOverlay: (opaque: boolean) => Promise<void>
  onOpaqueOverlayChanged: (callback: (opaque: boolean) => void) => () => void
  getAppVersion: () => Promise<string>

  // Window management
  openManager: () => Promise<void>
  hideOverlay: () => Promise<void>
  showOverlay: () => Promise<void>
  expandOverlayForBoard: () => Promise<void>
  restoreOverlayFromBoard: () => Promise<void>
  expandOverlayForSearch: () => Promise<void>
  restoreOverlayFromSearch: () => Promise<void>
  openDetails: (id: string) => Promise<void>
  onShowDetails: (callback: (id: string) => void) => () => void
  onShowHome: (callback: () => void) => () => void

  // Push events
  onInvestigationChanged: (callback: (investigations: Investigation[]) => void) => () => void
  onEntriesChanged: (callback: (investigationId: string, entries: JournalEntry[]) => void) => () => void
  onTriggerScreenshot: (callback: (dataUrl: string) => void) => () => void
  onTriggerUpload: (callback: () => void) => () => void
  onOnboardingReset: (callback: () => void) => () => void

  // Screenshot window helpers (used by screenshot renderer)
  onScreenshotData: (callback: (dataUrl: string) => void) => () => void
  sendScreenshotSelection: (rect: { x: number; y: number; width: number; height: number } | null) => void

  // Toolkit
  listTools: () => Promise<Tool[]>
  createTool: (name: string, toolType: ToolType, value: string, tags: string[], folderId?: string | null, parameters?: FunctionParameter[] | null) => Promise<Tool>
  createToolsBulk: (tools: { name: string; toolType: ToolType; value: string; tags: string[]; parameters?: FunctionParameter[] | null }[], folderId?: string | null) => Promise<Tool[]>
  updateTool: (id: string, name: string, toolType: ToolType, value: string, tags: string[], parameters?: FunctionParameter[] | null) => Promise<Tool>
  executeFunctionTool: (id: string, paramValues: Record<string, string>) => Promise<void>
  deleteTool: (id: string) => Promise<void>
  reorderTools: (orderedIds: string[]) => Promise<void>
  moveToolToFolder: (toolId: string, folderId: string | null) => Promise<void>
  moveToolsToFolder: (toolIds: string[], folderId: string | null) => Promise<void>
  reorderToolsInFolder: (folderId: string | null, orderedIds: string[]) => Promise<void>
  executeTool: (id: string) => Promise<void>
  getToolkitHotkey: () => Promise<string>
  setToolkitHotkey: (accelerator: string) => Promise<boolean>
  getManagerHotkey: () => Promise<string>
  setManagerHotkey: (accelerator: string) => Promise<boolean>
  showToolkitOverlay: () => Promise<void>
  hideToolkitOverlay: () => Promise<void>
  onToolsChanged: (callback: (tools: Tool[]) => void) => () => void

  // Tool Folders
  listToolFolders: () => Promise<ToolFolder[]>
  createToolFolder: (name: string, parentId?: string | null) => Promise<ToolFolder>
  renameToolFolder: (id: string, name: string) => Promise<ToolFolder>
  deleteToolFolder: (id: string) => Promise<void>
  moveToolFolderToFolder: (folderId: string, parentId: string | null) => Promise<void>
  reorderToolFoldersInParent: (parentId: string | null, orderedIds: string[]) => Promise<void>
  onToolFoldersChanged: (callback: (folders: ToolFolder[]) => void) => () => void

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
