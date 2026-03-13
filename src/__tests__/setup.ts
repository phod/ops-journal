import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'

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
  pickImage: vi.fn().mockResolvedValue(null),
  captureScreenshot: vi.fn().mockResolvedValue(null),
  getEntryImage: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
  openManager: vi.fn(),
  hideOverlay: vi.fn(),
  openDetails: vi.fn(),
  onShowDetails: vi.fn().mockReturnValue(() => {}),
  getHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+J'),
  setHotkey: vi.fn().mockResolvedValue(true),
  getScreenshotHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+S'),
  setScreenshotHotkey: vi.fn().mockResolvedValue(true),
  getUploadHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+U'),
  setUploadHotkey: vi.fn().mockResolvedValue(true),
  onInvestigationChanged: vi.fn().mockReturnValue(() => {}),
  onTriggerScreenshot: vi.fn().mockReturnValue(() => {}),
  onTriggerUpload: vi.fn().mockReturnValue(() => {}),
  onScreenshotData: vi.fn().mockReturnValue(() => {}),
  sendScreenshotSelection: vi.fn()
} as const

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
  DEFAULT_MOCKS.pickImage.mockResolvedValue(null)
  DEFAULT_MOCKS.captureScreenshot.mockResolvedValue(null)
  DEFAULT_MOCKS.getEntryImage.mockResolvedValue('data:image/png;base64,abc')
  DEFAULT_MOCKS.getHotkey.mockResolvedValue('CommandOrControl+Shift+J')
  DEFAULT_MOCKS.setHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.getScreenshotHotkey.mockResolvedValue('CommandOrControl+Shift+S')
  DEFAULT_MOCKS.setScreenshotHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.getUploadHotkey.mockResolvedValue('CommandOrControl+Shift+U')
  DEFAULT_MOCKS.setUploadHotkey.mockResolvedValue(true)
  DEFAULT_MOCKS.onInvestigationChanged.mockReturnValue(() => {})
  DEFAULT_MOCKS.onShowDetails.mockReturnValue(() => {})
  DEFAULT_MOCKS.onTriggerScreenshot.mockReturnValue(() => {})
  DEFAULT_MOCKS.onTriggerUpload.mockReturnValue(() => {})
  DEFAULT_MOCKS.onScreenshotData.mockReturnValue(() => {})
})
