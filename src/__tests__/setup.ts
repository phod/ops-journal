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
  openManager: vi.fn(),
  hideOverlay: vi.fn(),
  getHotkey: vi.fn().mockResolvedValue('CommandOrControl+Shift+J'),
  setHotkey: vi.fn().mockResolvedValue(true),
  onInvestigationChanged: vi.fn().mockReturnValue(() => {})
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
  mockElectronAPI.onInvestigationChanged.mockReturnValue(() => {})
})
