import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'
import { screen, within, queryHelpers } from '@testing-library/react'

// Custom queries for data-tooltip (replaces native title attribute)
function queryAllByTooltip(container: HTMLElement, tooltip: string) {
  return Array.from(container.querySelectorAll<HTMLElement>(`[data-tooltip="${CSS.escape(tooltip)}"]`))
}

const [queryByTooltip, getAllByTooltip, getByTooltip, findAllByTooltip, findByTooltip] =
  queryHelpers.buildQueries<[string]>(
    queryAllByTooltip,
    (_, tooltip) => `Unable to find an element with the data-tooltip: ${tooltip}`,
    (_, tooltip) => `Found multiple elements with the data-tooltip: ${tooltip}`
  )

// Patch screen with tooltip queries
Object.assign(screen, {
  getByTooltip: (tooltip: string) => getByTooltip(document.body, tooltip),
  getAllByTooltip: (tooltip: string) => getAllByTooltip(document.body, tooltip),
  queryByTooltip: (tooltip: string) => queryByTooltip(document.body, tooltip),
  findByTooltip: (tooltip: string) => findByTooltip(document.body, tooltip),
  findAllByTooltip: (tooltip: string) => findAllByTooltip(document.body, tooltip),
})

// Re-export for use in tests
declare module '@testing-library/react' {
  interface Screen {
    getByTooltip(tooltip: string): HTMLElement
    getAllByTooltip(tooltip: string): HTMLElement[]
    queryByTooltip(tooltip: string): HTMLElement | null
    findByTooltip(tooltip: string): Promise<HTMLElement>
    findAllByTooltip(tooltip: string): Promise<HTMLElement[]>
  }
}

const DEFAULT_MOCKS = {
  getActiveInvestigations: vi.fn().mockResolvedValue([]),
  listInvestigations: vi.fn().mockResolvedValue([]),
  createInvestigation: vi.fn(),
  deleteInvestigation: vi.fn(),
  setActiveInvestigation: vi.fn(),
  deactivateInvestigation: vi.fn(),
  listEntries: vi.fn().mockResolvedValue([]),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  toggleActionCompleted: vi.fn(),
  toggleFlagged: vi.fn(),
  updateToolEntryStatus: vi.fn(),
  updateHypothesisStatus: vi.fn(),
  linkHypothesisFinding: vi.fn(),
  unlinkHypothesisFinding: vi.fn(),
  getHypothesisFindings: vi.fn().mockResolvedValue([]),
  getFindingHypotheses: vi.fn().mockResolvedValue([]),
  linkHypothesisChild: vi.fn(),
  unlinkHypothesisChild: vi.fn(),
  getHypothesisNestingDepth: vi.fn().mockResolvedValue(0),
  getSummary: vi.fn().mockResolvedValue(null),
  saveSummary: vi.fn(),
  saveSummaryImage: vi.fn(),
  exportInvestigation: vi.fn().mockResolvedValue({ success: true }),
  pickImage: vi.fn().mockResolvedValue(null),
  captureScreenshot: vi.fn().mockResolvedValue(null),
  getEntryImage: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
  showImageContextMenu: vi.fn(),
  openManager: vi.fn(),
  hideOverlay: vi.fn(),
  showOverlay: vi.fn(),
  expandOverlayForBoard: vi.fn(),
  restoreOverlayFromBoard: vi.fn(),
  openDetails: vi.fn(),
  onShowDetails: vi.fn().mockReturnValue(() => {}),
  onShowHome: vi.fn().mockReturnValue(() => {}),
  onShowReminders: vi.fn().mockReturnValue(() => {}),
  getHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+J'),
  setHotkey: vi.fn().mockResolvedValue(true),
  getScreenshotHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+S'),
  setScreenshotHotkey: vi.fn().mockResolvedValue(true),
  getUploadHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+U'),
  setUploadHotkey: vi.fn().mockResolvedValue(true),
  getLastViewedInvestigationId: vi.fn().mockResolvedValue(null),
  setLastViewedInvestigationId: vi.fn().mockResolvedValue(undefined),
  getMinimapOpen: vi.fn().mockResolvedValue(false),
  setMinimapOpen: vi.fn(),
  onInvestigationChanged: vi.fn().mockReturnValue(() => {}),
  onEntriesChanged: vi.fn().mockReturnValue(() => {}),
  onTriggerScreenshot: vi.fn().mockReturnValue(() => {}),
  onTriggerUpload: vi.fn().mockReturnValue(() => {}),
  onScreenshotData: vi.fn().mockReturnValue(() => {}),
  sendScreenshotSelection: vi.fn(),
  listBoards: vi.fn().mockResolvedValue([]),
  createBoard: vi.fn(),
  deleteBoard: vi.fn(),
  renameBoard: vi.fn(),
  getBoardState: vi.fn().mockResolvedValue({ board: {}, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }),
  saveBoardState: vi.fn().mockResolvedValue(undefined),
  saveBoardImage: vi.fn(),
  renameInvestigation: vi.fn(),
  getOnboardingDismissed: vi.fn().mockResolvedValue(false),
  setOnboardingDismissed: vi.fn(),
  getOpaqueOverlay: vi.fn().mockResolvedValue(false),
  setOpaqueOverlay: vi.fn(),
  onOpaqueOverlayChanged: vi.fn().mockReturnValue(() => {}),
  getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
  listTools: vi.fn().mockResolvedValue([]),
  createTool: vi.fn(),
  updateTool: vi.fn(),
  deleteTool: vi.fn(),
  duplicateTool: vi.fn(),
  reorderTools: vi.fn(),
  executeTool: vi.fn(),
  getToolkitHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+K'),
  setToolkitHotkey: vi.fn().mockResolvedValue(true),
  getManagerHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+M'),
  setManagerHotkey: vi.fn().mockResolvedValue(true),
  showToolkitOverlay: vi.fn(),
  hideToolkitOverlay: vi.fn(),
  onToolsChanged: vi.fn().mockReturnValue(() => {}),
  getTokeniserHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+L'),
  setTokeniserHotkey: vi.fn().mockResolvedValue(true),
  showTokeniserOverlay: vi.fn(),
  hideTokeniserOverlay: vi.fn(),
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  readClipboard: vi.fn().mockResolvedValue(''),
  onTokeniserShown: vi.fn().mockReturnValue(() => {}),
  createToolsBulk: vi.fn().mockResolvedValue([]),
  moveToolToFolder: vi.fn().mockResolvedValue(undefined),
  moveToolsToFolder: vi.fn().mockResolvedValue(undefined),
  reorderToolsInFolder: vi.fn().mockResolvedValue(undefined),
  executeFunctionTool: vi.fn().mockResolvedValue(undefined),
  listPendingToolEntries: vi.fn().mockResolvedValue([]),
  createToolFromEntry: vi.fn(),
  abandonToolEntry: vi.fn(),
  listToolFolders: vi.fn().mockResolvedValue([]),
  createToolFolder: vi.fn(),
  renameToolFolder: vi.fn(),
  deleteToolFolder: vi.fn(),
  moveToolFolderToFolder: vi.fn(),
  reorderToolFoldersInParent: vi.fn(),
  onToolFoldersChanged: vi.fn().mockReturnValue(() => {}),
  onCheckDirty: vi.fn().mockReturnValue(() => {}),
  replyCheckDirty: vi.fn(),
  expandOverlayForSearch: vi.fn(),
  restoreOverlayFromSearch: vi.fn(),
  reorderInvestigations: vi.fn(),
  linkHypothesisAction: vi.fn(),
  unlinkHypothesisAction: vi.fn(),
  onOnboardingReset: vi.fn().mockReturnValue(() => {}),
  openExternal: vi.fn().mockResolvedValue(undefined)
} as const

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'electronAPI', {
    value: DEFAULT_MOCKS,
    writable: true
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  // Restore default return values after clearAllMocks resets them
  DEFAULT_MOCKS.getActiveInvestigations.mockResolvedValue([])
  DEFAULT_MOCKS.listInvestigations.mockResolvedValue([])
  DEFAULT_MOCKS.listEntries.mockResolvedValue([])
  DEFAULT_MOCKS.getHypothesisFindings.mockResolvedValue([])
  DEFAULT_MOCKS.getFindingHypotheses.mockResolvedValue([])
  DEFAULT_MOCKS.getHypothesisNestingDepth.mockResolvedValue(0)
  DEFAULT_MOCKS.getSummary.mockResolvedValue(null)
  DEFAULT_MOCKS.exportInvestigation.mockResolvedValue({ success: true })
  DEFAULT_MOCKS.pickImage.mockResolvedValue(null)
  DEFAULT_MOCKS.captureScreenshot.mockResolvedValue(null)
  DEFAULT_MOCKS.getEntryImage.mockResolvedValue('data:image/png;base64,abc')
  DEFAULT_MOCKS.getHotkey.mockResolvedValue('CommandOrControl+Shift+J')
  DEFAULT_MOCKS.setHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.getScreenshotHotkey.mockResolvedValue('CommandOrControl+Shift+S')
  DEFAULT_MOCKS.setScreenshotHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.getUploadHotkey.mockResolvedValue('CommandOrControl+Shift+U')
  DEFAULT_MOCKS.setUploadHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.getLastViewedInvestigationId.mockResolvedValue(null)
  DEFAULT_MOCKS.getMinimapOpen.mockResolvedValue(false)
  DEFAULT_MOCKS.onInvestigationChanged.mockReturnValue(() => {})
  DEFAULT_MOCKS.onEntriesChanged.mockReturnValue(() => {})
  DEFAULT_MOCKS.onShowDetails.mockReturnValue(() => {})
  DEFAULT_MOCKS.onShowHome.mockReturnValue(() => {})
  DEFAULT_MOCKS.onTriggerScreenshot.mockReturnValue(() => {})
  DEFAULT_MOCKS.onTriggerUpload.mockReturnValue(() => {})
  DEFAULT_MOCKS.onScreenshotData.mockReturnValue(() => {})
  DEFAULT_MOCKS.getBoardState.mockResolvedValue({ board: {}, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } })
  DEFAULT_MOCKS.listBoards.mockResolvedValue([])
  DEFAULT_MOCKS.listTools.mockResolvedValue([])
  DEFAULT_MOCKS.getToolkitHotkey.mockResolvedValue('CommandOrControl+Shift+K')
  DEFAULT_MOCKS.setToolkitHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.getManagerHotkey.mockResolvedValue('CommandOrControl+Shift+M')
  DEFAULT_MOCKS.setManagerHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.onToolsChanged.mockReturnValue(() => {})
  DEFAULT_MOCKS.getTokeniserHotkey.mockResolvedValue('CommandOrControl+Shift+L')
  DEFAULT_MOCKS.setTokeniserHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.copyToClipboard.mockResolvedValue(undefined)
  DEFAULT_MOCKS.readClipboard.mockResolvedValue('')
  DEFAULT_MOCKS.onTokeniserShown.mockReturnValue(() => {})
  DEFAULT_MOCKS.getOpaqueOverlay.mockResolvedValue(false)
  DEFAULT_MOCKS.onOpaqueOverlayChanged.mockReturnValue(() => {})
  DEFAULT_MOCKS.listPendingToolEntries.mockResolvedValue([])
  DEFAULT_MOCKS.listToolFolders.mockResolvedValue([])
  DEFAULT_MOCKS.onToolFoldersChanged.mockReturnValue(() => {})
  DEFAULT_MOCKS.onCheckDirty.mockReturnValue(() => {})
  DEFAULT_MOCKS.onOnboardingReset.mockReturnValue(() => {})
})
