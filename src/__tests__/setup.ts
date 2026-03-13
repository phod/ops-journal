import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'

const mockElectronAPI = {
  getActiveInvestigation: vi.fn().mockResolvedValue(null),
  listInvestigations: vi.fn().mockResolvedValue([]),
  createInvestigation: vi.fn(),
  deleteInvestigation: vi.fn(),
  setActiveInvestigation: vi.fn(),
  listEntries: vi.fn().mockResolvedValue([]),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  pickImage: vi.fn().mockResolvedValue(null),
  captureScreenshot: vi.fn().mockResolvedValue(null),
  getEntryImage: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
  openManager: vi.fn(),
  hideOverlay: vi.fn(),
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
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Re-apply defaults after clearAllMocks
  mockElectronAPI.getActiveInvestigation.mockResolvedValue(null)
  mockElectronAPI.listInvestigations.mockResolvedValue([])
  mockElectronAPI.listEntries.mockResolvedValue([])
  mockElectronAPI.getHotkey.mockResolvedValue('CommandOrControl+Shift+J')
  mockElectronAPI.setHotkey.mockResolvedValue(true)
  mockElectronAPI.getScreenshotHotkey.mockResolvedValue('CommandOrControl+Shift+S')
  mockElectronAPI.setScreenshotHotkey.mockResolvedValue(true)
  mockElectronAPI.getUploadHotkey.mockResolvedValue('CommandOrControl+Shift+U')
  mockElectronAPI.setUploadHotkey.mockResolvedValue(true)
  mockElectronAPI.pickImage.mockResolvedValue(null)
  mockElectronAPI.captureScreenshot.mockResolvedValue(null)
  mockElectronAPI.getEntryImage.mockResolvedValue('data:image/png;base64,abc')
  mockElectronAPI.onInvestigationChanged.mockReturnValue(() => {})
  mockElectronAPI.onTriggerScreenshot.mockReturnValue(() => {})
  mockElectronAPI.onTriggerUpload.mockReturnValue(() => {})
  mockElectronAPI.onScreenshotData.mockReturnValue(() => {})
})
