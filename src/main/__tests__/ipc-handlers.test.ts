import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Hoisted mocks (vi.mock factories are hoisted above imports) ---

const {
  mockInvestigations,
  mockEntries,
  mockBoards,
  mockImages,
  mockWindows,
  mockHotkey,
  mockSettings,
  mockScreenshot,
  mockExport,
  mockTools,
  mockToolFolders,
  mockHandlers,
  mockWebContentsSend,
  mockWindow
} = vi.hoisted(() => {
  const mockInvestigations = {
    getActiveInvestigations: vi.fn().mockReturnValue([]),
    listInvestigations: vi.fn().mockReturnValue([]),
    createInvestigation: vi.fn().mockReturnValue({ id: 'inv-1', name: 'Test' }),
    deleteInvestigation: vi.fn(),
    setActiveInvestigation: vi.fn().mockReturnValue({ id: 'inv-1', is_active: 1 }),
    deactivateInvestigation: vi.fn(),
    getSummary: vi.fn().mockReturnValue(null),
    saveSummary: vi.fn()
  }

  const mockEntries = {
    listEntries: vi.fn().mockReturnValue([]),
    createEntry: vi.fn().mockReturnValue({ id: 'e1', investigation_id: 'inv-1', body: 'test', image_paths: [] }),
    updateEntry: vi.fn().mockReturnValue({ id: 'e1', investigation_id: 'inv-1', body: 'updated', image_paths: [] }),
    deleteEntry: vi.fn(),
    getEntry: vi.fn(),
    toggleActionCompleted: vi.fn(),
    toggleFlagged: vi.fn(),
    updateHypothesisStatus: vi.fn().mockReturnValue({ id: 'e1', investigation_id: 'inv-1' }),
    linkHypothesisFinding: vi.fn().mockReturnValue({ id: 'e1', investigation_id: 'inv-1' }),
    unlinkHypothesisFinding: vi.fn().mockReturnValue({ id: 'e1', investigation_id: 'inv-1' }),
    getHypothesisFindings: vi.fn().mockReturnValue([]),
    getFindingHypotheses: vi.fn().mockReturnValue([]),
    linkHypothesisChild: vi.fn().mockReturnValue({ id: 'e1', investigation_id: 'inv-1' }),
    unlinkHypothesisChild: vi.fn().mockReturnValue({ id: 'e1', investigation_id: 'inv-1' }),
    getHypothesisNestingDepth: vi.fn().mockReturnValue(0),
    updateToolEntryStatus: vi.fn().mockReturnValue({ id: 'e1', investigation_id: 'inv-1' }),
    listPendingToolEntries: vi.fn().mockReturnValue([])
  }

  const mockBoards = {
    listBoards: vi.fn().mockReturnValue([]),
    createBoard: vi.fn().mockReturnValue({ id: 'b1' }),
    deleteBoard: vi.fn(),
    renameBoard: vi.fn().mockReturnValue({ id: 'b1', name: 'Renamed' }),
    getBoardState: vi.fn().mockReturnValue({ board: {}, nodes: [], edges: [] }),
    saveBoardState: vi.fn()
  }

  const mockImages = {
    saveImage: vi.fn().mockReturnValue('/saved/image.png'),
    deleteImage: vi.fn(),
    readImageAsDataUrl: vi.fn().mockReturnValue('data:image/png;base64,abc')
  }

  const mockWindows = {
    getOverlayWindow: vi.fn(),
    showManager: vi.fn(),
    hideOverlay: vi.fn(),
    showOverlay: vi.fn(),
    navigateManagerToDetails: vi.fn(),
    showManagerReminders: vi.fn(),
    expandOverlayForBoard: vi.fn(),
    restoreOverlayFromBoard: vi.fn()
  }

  const mockHotkey = {
    reregisterHotkey: vi.fn(),
    reregisterScreenshotHotkey: vi.fn(),
    reregisterUploadHotkey: vi.fn()
  }

  const mockSettings = {
    getHotkey: vi.fn().mockReturnValue('CmdOrCtrl+Shift+J'),
    getScreenshotHotkey: vi.fn().mockReturnValue('CmdOrCtrl+Shift+S'),
    getUploadHotkey: vi.fn().mockReturnValue('CmdOrCtrl+Shift+U'),
    getLastViewedInvestigationId: vi.fn().mockReturnValue(null),
    setLastViewedInvestigationId: vi.fn(),
    getMinimapOpen: vi.fn().mockReturnValue(false),
    setMinimapOpen: vi.fn()
  }

  const mockScreenshot = { captureScreenshot: vi.fn() }

  const mockExport = {
    exportAsMarkdown: vi.fn().mockReturnValue('# Export'),
    exportAsPdf: vi.fn(),
    buildExportHtml: vi.fn().mockReturnValue('<html></html>')
  }

  const mockHandlers = new Map<string, Function>()
  const mockWebContentsSend = vi.fn()
  const mockWindow = { isDestroyed: () => false, webContents: { send: mockWebContentsSend } }

  const mockTools = {
    listTools: vi.fn().mockReturnValue([]),
    createTool: vi.fn().mockReturnValue({ id: 'tool-1', name: 'Test Tool' }),
    createToolsBulk: vi.fn().mockReturnValue([]),
    updateTool: vi.fn(),
    deleteTool: vi.fn(),
    reorderTools: vi.fn(),
    moveToolToFolder: vi.fn(),
    moveToolsToFolder: vi.fn(),
    reorderToolsInFolder: vi.fn()
  }

  const mockToolFolders = {
    listToolFolders: vi.fn().mockReturnValue([]),
    createToolFolder: vi.fn().mockReturnValue({ id: 'tf-1', name: 'Test Folder' }),
    renameToolFolder: vi.fn(),
    deleteToolFolder: vi.fn(),
    moveToolFolderToFolder: vi.fn(),
    reorderToolFoldersInParent: vi.fn()
  }

  return {
    mockInvestigations, mockEntries, mockBoards, mockImages, mockWindows,
    mockHotkey, mockSettings, mockScreenshot, mockExport,
    mockTools, mockToolFolders,
    mockHandlers, mockWebContentsSend, mockWindow
  }
})

vi.mock('../db/investigations', () => mockInvestigations)
vi.mock('../db/entries', () => mockEntries)
vi.mock('../db/rumour-boards', () => mockBoards)
vi.mock('../db/tools', () => mockTools)
vi.mock('../db/tool-folders', () => mockToolFolders)
vi.mock('../images', () => mockImages)
vi.mock('../windows', () => mockWindows)
vi.mock('../hotkey', () => mockHotkey)
vi.mock('../settings', () => mockSettings)
vi.mock('../screenshot', () => mockScreenshot)
vi.mock('../export', () => mockExport)

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      mockHandlers.set(channel, handler)
    })
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [mockWindow]),
    getFocusedWindow: vi.fn(() => mockWindow),
    fromWebContents: vi.fn(() => mockWindow)
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: true })
  },
  // Electron 44+ clipboard: write/writeText are async, writeImage no longer exists
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined), write: vi.fn().mockResolvedValue(undefined) },
  ClipboardItem: class FakeClipboardItem {
    types: string[]
    constructor(public items: Record<string, unknown>) {
      this.types = Object.keys(items)
    }
    async getType(type: string) {
      return this.items[type]
    }
  },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn(), openExternal: vi.fn().mockResolvedValue(undefined) },
  Menu: { buildFromTemplate: vi.fn(() => ({ popup: vi.fn() })) },
  nativeImage: { createFromPath: vi.fn(() => ({ toPNG: () => Buffer.from([1, 2, 3]) })) }
}))

import { registerIpcHandlers } from '../ipc-handlers'

function invoke(channel: string, ...args: unknown[]) {
  const handler = mockHandlers.get(channel)
  if (!handler) throw new Error(`No handler for channel: ${channel}`)
  return handler({ sender: mockWindow.webContents }, ...args)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHandlers.clear()

  // Restore mocks that clearAllMocks resets
  mockInvestigations.getActiveInvestigations.mockReturnValue([])
  mockInvestigations.createInvestigation.mockReturnValue({ id: 'inv-1', name: 'Test' })
  mockInvestigations.setActiveInvestigation.mockReturnValue({ id: 'inv-1', is_active: 1 })
  mockEntries.listEntries.mockReturnValue([])
  mockEntries.createEntry.mockReturnValue({ id: 'e1', investigation_id: 'inv-1', body: 'test', image_paths: [] })
  mockEntries.updateEntry.mockReturnValue({ id: 'e1', investigation_id: 'inv-1', body: 'updated', image_paths: [] })
  mockEntries.getEntry.mockReturnValue(null)
  mockEntries.toggleActionCompleted.mockReturnValue(null)
  mockEntries.toggleFlagged.mockReturnValue(null)
  mockEntries.updateHypothesisStatus.mockReturnValue({ id: 'e1', investigation_id: 'inv-1' })
  mockEntries.linkHypothesisFinding.mockReturnValue({ id: 'e1', investigation_id: 'inv-1' })
  mockEntries.unlinkHypothesisFinding.mockReturnValue({ id: 'e1', investigation_id: 'inv-1' })
  mockEntries.linkHypothesisChild.mockReturnValue({ id: 'e1', investigation_id: 'inv-1' })
  mockEntries.unlinkHypothesisChild.mockReturnValue({ id: 'e1', investigation_id: 'inv-1' })
  mockImages.saveImage.mockReturnValue('/saved/image.png')
  mockExport.exportAsMarkdown.mockReturnValue('# Export')
  mockTools.listTools.mockReturnValue([])
  mockTools.createTool.mockReturnValue({ id: 'tool-1', name: 'Test Tool' })
  mockToolFolders.listToolFolders.mockReturnValue([])
  mockEntries.updateToolEntryStatus.mockReturnValue({ id: 'e1', investigation_id: 'inv-1' })

  registerIpcHandlers()
})

// ---------------------------------------------------------------------------
// Investigations
// ---------------------------------------------------------------------------

describe('investigation handlers', () => {
  it('investigation:getActive calls getActiveInvestigations', () => {
    invoke('investigation:getActive')
    expect(mockInvestigations.getActiveInvestigations).toHaveBeenCalled()
  })

  it('investigation:list calls listInvestigations', () => {
    invoke('investigation:list')
    expect(mockInvestigations.listInvestigations).toHaveBeenCalled()
  })

  it('investigation:create calls createInvestigation with name', () => {
    invoke('investigation:create', { name: 'Outage' })
    expect(mockInvestigations.createInvestigation).toHaveBeenCalledWith('Outage')
  })

  it('investigation:delete deletes and broadcasts', () => {
    invoke('investigation:delete', { id: 'inv-1' })
    expect(mockInvestigations.deleteInvestigation).toHaveBeenCalledWith('inv-1')
    expect(mockWebContentsSend).toHaveBeenCalledWith('investigation:changed', [])
  })

  it('investigation:setActive activates and broadcasts', () => {
    const result = invoke('investigation:setActive', { id: 'inv-1' })
    expect(mockInvestigations.setActiveInvestigation).toHaveBeenCalledWith('inv-1')
    expect(mockWebContentsSend).toHaveBeenCalledWith('investigation:changed', [])
    expect(result).toEqual({ id: 'inv-1', is_active: 1 })
  })

  it('investigation:deactivate deactivates and broadcasts', () => {
    invoke('investigation:deactivate', { id: 'inv-1' })
    expect(mockInvestigations.deactivateInvestigation).toHaveBeenCalledWith('inv-1')
    expect(mockWebContentsSend).toHaveBeenCalledWith('investigation:changed', [])
  })
})

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

describe('entry handlers', () => {
  it('entry:list calls listEntries', () => {
    invoke('entry:list', { investigationId: 'inv-1' })
    expect(mockEntries.listEntries).toHaveBeenCalledWith('inv-1')
  })

  it('entry:create saves images and broadcasts', () => {
    invoke('entry:create', {
      investigationId: 'inv-1',
      body: 'Found something',
      imageDataUrls: ['data:image/png;base64,abc'],
      type: 'finding'
    })
    expect(mockImages.saveImage).toHaveBeenCalled()
    expect(mockEntries.createEntry).toHaveBeenCalledWith('inv-1', 'Found something', ['/saved/image.png'], 'finding')
    expect(mockWebContentsSend).toHaveBeenCalledWith('entries:changed', 'inv-1', [])
  })

  it('entry:create works without images', () => {
    invoke('entry:create', { investigationId: 'inv-1', body: 'Note' })
    expect(mockImages.saveImage).not.toHaveBeenCalled()
    expect(mockEntries.createEntry).toHaveBeenCalledWith('inv-1', 'Note', [], undefined)
  })

  it('entry:update deletes removed images and broadcasts', () => {
    mockEntries.getEntry.mockReturnValue({ image_paths: ['/img/a.png', '/img/b.png'] })
    invoke('entry:update', { id: 'e1', body: 'updated', keepImagePaths: ['/img/a.png'] })
    expect(mockImages.deleteImage).toHaveBeenCalledWith('/img/b.png')
    expect(mockImages.deleteImage).not.toHaveBeenCalledWith('/img/a.png')
  })

  it('entry:update saves new images', () => {
    mockEntries.getEntry.mockReturnValue({ image_paths: [] })
    invoke('entry:update', { id: 'e1', body: 'updated', newImageDataUrls: ['data:image/png;base64,xyz'] })
    expect(mockImages.saveImage).toHaveBeenCalled()
  })

  it('entry:delete removes images and broadcasts', () => {
    mockEntries.deleteEntry.mockReturnValue({ investigation_id: 'inv-1', image_paths: ['/img/a.png'] })
    invoke('entry:delete', { id: 'e1' })
    expect(mockImages.deleteImage).toHaveBeenCalledWith('/img/a.png')
    expect(mockWebContentsSend).toHaveBeenCalledWith('entries:changed', 'inv-1', [])
  })

  it('entry:delete is a no-op when entry not found', () => {
    mockEntries.deleteEntry.mockReturnValue(null)
    invoke('entry:delete', { id: 'missing' })
    expect(mockImages.deleteImage).not.toHaveBeenCalled()
    expect(mockWebContentsSend).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Actions & Flagging
// ---------------------------------------------------------------------------

describe('action and flagging handlers', () => {
  it('action:toggleCompleted broadcasts when entry exists', () => {
    mockEntries.toggleActionCompleted.mockReturnValue({ id: 'e1', investigation_id: 'inv-1' })
    invoke('action:toggleCompleted', { entryId: 'e1' })
    expect(mockWebContentsSend).toHaveBeenCalledWith('entries:changed', 'inv-1', [])
  })

  it('action:toggleCompleted does not broadcast when entry is null', () => {
    mockEntries.toggleActionCompleted.mockReturnValue(null)
    invoke('action:toggleCompleted', { entryId: 'missing' })
    expect(mockWebContentsSend).not.toHaveBeenCalled()
  })

  it('entry:toggleFlagged broadcasts when entry exists', () => {
    mockEntries.toggleFlagged.mockReturnValue({ id: 'e1', investigation_id: 'inv-1' })
    invoke('entry:toggleFlagged', { entryId: 'e1' })
    expect(mockWebContentsSend).toHaveBeenCalledWith('entries:changed', 'inv-1', [])
  })
})

// ---------------------------------------------------------------------------
// Hypotheses
// ---------------------------------------------------------------------------

describe('hypothesis handlers', () => {
  it('hypothesis:updateStatus calls updateHypothesisStatus and broadcasts', () => {
    invoke('hypothesis:updateStatus', { entryId: 'e1', status: 'true' })
    expect(mockEntries.updateHypothesisStatus).toHaveBeenCalledWith('e1', 'true')
    expect(mockWebContentsSend).toHaveBeenCalled()
  })

  it('hypothesis:linkFinding links and broadcasts', () => {
    invoke('hypothesis:linkFinding', { hypothesisId: 'h1', findingId: 'f1' })
    expect(mockEntries.linkHypothesisFinding).toHaveBeenCalledWith('h1', 'f1')
    expect(mockWebContentsSend).toHaveBeenCalled()
  })

  it('hypothesis:unlinkFinding unlinks and broadcasts', () => {
    invoke('hypothesis:unlinkFinding', { hypothesisId: 'h1', findingId: 'f1' })
    expect(mockEntries.unlinkHypothesisFinding).toHaveBeenCalledWith('h1', 'f1')
  })

  it('hypothesis:getFindings returns findings', () => {
    invoke('hypothesis:getFindings', { hypothesisId: 'h1' })
    expect(mockEntries.getHypothesisFindings).toHaveBeenCalledWith('h1')
  })

  it('finding:getHypotheses returns hypotheses', () => {
    invoke('finding:getHypotheses', { findingId: 'f1' })
    expect(mockEntries.getFindingHypotheses).toHaveBeenCalledWith('f1')
  })

  it('hypothesis:linkChild links and broadcasts', () => {
    invoke('hypothesis:linkChild', { parentId: 'h1', childId: 'h2' })
    expect(mockEntries.linkHypothesisChild).toHaveBeenCalledWith('h1', 'h2')
    expect(mockWebContentsSend).toHaveBeenCalled()
  })

  it('hypothesis:unlinkChild unlinks and broadcasts', () => {
    invoke('hypothesis:unlinkChild', { parentId: 'h1', childId: 'h2' })
    expect(mockEntries.unlinkHypothesisChild).toHaveBeenCalledWith('h1', 'h2')
  })

  it('hypothesis:getNestingDepth returns depth', () => {
    mockEntries.getHypothesisNestingDepth.mockReturnValue(3)
    const result = invoke('hypothesis:getNestingDepth', { hypothesisId: 'h1' })
    expect(result).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe('summary handlers', () => {
  it('summary:get calls getSummary', () => {
    invoke('summary:get', { investigationId: 'inv-1' })
    expect(mockInvestigations.getSummary).toHaveBeenCalledWith('inv-1')
  })

  it('summary:save calls saveSummary', () => {
    invoke('summary:save', { investigationId: 'inv-1', summaryJson: '{}' })
    expect(mockInvestigations.saveSummary).toHaveBeenCalledWith('inv-1', '{}')
  })

  it('summary:saveImage saves an image from data URL', () => {
    invoke('summary:saveImage', { dataUrl: 'data:image/png;base64,abc' })
    expect(mockImages.saveImage).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

describe('board handlers', () => {
  it('board:list calls listBoards', () => {
    invoke('board:list', { investigationId: 'inv-1' })
    expect(mockBoards.listBoards).toHaveBeenCalledWith('inv-1')
  })

  it('board:create calls createBoard', () => {
    invoke('board:create', { investigationId: 'inv-1', name: 'My Board' })
    expect(mockBoards.createBoard).toHaveBeenCalledWith('inv-1', 'My Board')
  })

  it('board:delete calls deleteBoard', () => {
    invoke('board:delete', { boardId: 'b1' })
    expect(mockBoards.deleteBoard).toHaveBeenCalledWith('b1')
  })

  it('board:rename calls renameBoard', () => {
    invoke('board:rename', { boardId: 'b1', name: 'New Name' })
    expect(mockBoards.renameBoard).toHaveBeenCalledWith('b1', 'New Name')
  })

  it('board:getState calls getBoardState', () => {
    invoke('board:getState', { boardId: 'b1' })
    expect(mockBoards.getBoardState).toHaveBeenCalledWith('b1')
  })

  it('board:saveState calls saveBoardState', () => {
    const state = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
    invoke('board:saveState', { boardId: 'b1', state })
    expect(mockBoards.saveBoardState).toHaveBeenCalledWith('b1', state)
  })
})

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe('settings handlers', () => {
  it('settings:getHotkey calls getHotkey', () => {
    invoke('settings:getHotkey')
    expect(mockSettings.getHotkey).toHaveBeenCalled()
  })

  it('settings:setHotkey calls reregisterHotkey', () => {
    invoke('settings:setHotkey', { accelerator: 'CmdOrCtrl+Shift+K' })
    expect(mockHotkey.reregisterHotkey).toHaveBeenCalledWith('CmdOrCtrl+Shift+K')
  })

  it('settings:getLastViewedInvestigationId calls getter', () => {
    invoke('settings:getLastViewedInvestigationId')
    expect(mockSettings.getLastViewedInvestigationId).toHaveBeenCalled()
  })

  it('settings:setLastViewedInvestigationId calls setter', () => {
    invoke('settings:setLastViewedInvestigationId', { id: 'inv-1' })
    expect(mockSettings.setLastViewedInvestigationId).toHaveBeenCalledWith('inv-1')
  })

  it('settings:getMinimapOpen calls getter', () => {
    invoke('settings:getMinimapOpen')
    expect(mockSettings.getMinimapOpen).toHaveBeenCalled()
  })

  it('settings:setMinimapOpen calls setter', () => {
    invoke('settings:setMinimapOpen', { open: true })
    expect(mockSettings.setMinimapOpen).toHaveBeenCalledWith(true)
  })
})

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------

describe('window management handlers', () => {
  it('window:openManager calls showManager', () => {
    invoke('window:openManager')
    expect(mockWindows.showManager).toHaveBeenCalled()
  })

  it('overlay:hide calls hideOverlay', () => {
    invoke('overlay:hide')
    expect(mockWindows.hideOverlay).toHaveBeenCalled()
  })

  it('overlay:show calls showOverlay', () => {
    invoke('overlay:show')
    expect(mockWindows.showOverlay).toHaveBeenCalled()
  })

  it('window:openDetails calls navigateManagerToDetails', () => {
    invoke('window:openDetails', { id: 'inv-1' })
    expect(mockWindows.navigateManagerToDetails).toHaveBeenCalledWith('inv-1')
  })
})

// ---------------------------------------------------------------------------
// Tool entries
// ---------------------------------------------------------------------------

describe('tool entry handlers', () => {
  it('toolEntry:createFromEntry passes folderId to createTool', () => {
    invoke('toolEntry:createFromEntry', {
      entryId: 'e1',
      name: 'My Tool',
      toolType: 'link',
      value: 'https://example.com',
      tags: ['tag1'],
      parameters: null,
      folderId: 'folder-1'
    })

    expect(mockTools.createTool).toHaveBeenCalledWith(
      'My Tool', 'link', 'https://example.com', ['tag1'], 'folder-1', null
    )
  })

  it('toolEntry:createFromEntry passes undefined folderId when not provided', () => {
    invoke('toolEntry:createFromEntry', {
      entryId: 'e1',
      name: 'My Tool',
      toolType: 'string',
      value: 'some value',
      tags: []
    })

    expect(mockTools.createTool).toHaveBeenCalledWith(
      'My Tool', 'string', 'some value', [], undefined, undefined
    )
  })
})

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

describe('broadcast behavior', () => {
  it('does not send to destroyed windows', async () => {
    const { BrowserWindow } = await import('electron')
    const destroyedWindow = { isDestroyed: () => true, webContents: { send: vi.fn() } }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([destroyedWindow as unknown as Electron.BrowserWindow, mockWindow as unknown as Electron.BrowserWindow])

    invoke('investigation:delete', { id: 'inv-1' })
    expect(destroyedWindow.webContents.send).not.toHaveBeenCalled()
    expect(mockWebContentsSend).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Clipboard (Electron 44+ W3C-style clipboard API)
// ---------------------------------------------------------------------------

describe('clipboard handlers', () => {
  const exportArgs = { investigationId: 'inv-1', investigationName: 'Test', entryIds: [] as string[] }

  it('writes rich-clipboard export as a single ClipboardItem with text and html', async () => {
    const { clipboard, ClipboardItem } = await import('electron')

    const result = await invoke('investigation:export', { ...exportArgs, format: 'rich-clipboard' })

    expect(result).toEqual({ success: true })
    expect(clipboard.write).toHaveBeenCalledTimes(1)
    const [items] = vi.mocked(clipboard.write).mock.calls[0]
    expect(items).toHaveLength(1)
    expect(items[0]).toBeInstanceOf(ClipboardItem)
    expect(items[0].types.sort()).toEqual(['text/html', 'text/plain'])
    await expect(items[0].getType('text/plain')).resolves.toBe('# Export')
    await expect(items[0].getType('text/html')).resolves.toBe('<html></html>')
  })

  it('reports failure when the plain clipboard write rejects', async () => {
    const { clipboard } = await import('electron')
    vi.mocked(clipboard.writeText).mockRejectedValueOnce(new Error('clipboard busy'))

    const result = await invoke('investigation:export', { ...exportArgs, format: 'clipboard' })

    expect(clipboard.writeText).toHaveBeenCalledWith('# Export')
    expect(result).toEqual({ success: false, error: 'clipboard busy' })
  })

  it('copies an image from the context menu as a PNG ClipboardItem', async () => {
    const { clipboard, ClipboardItem, Menu } = await import('electron')

    invoke('image:contextMenu', { imagePath: '/images/shot.png' })

    const [template] = vi.mocked(Menu.buildFromTemplate).mock.calls[0]
    const copyItem = template.find((item) => item.label === 'Copy Image')
    expect(copyItem).toBeDefined()
    await copyItem!.click!(undefined as never, undefined as never, undefined as never)

    expect(clipboard.write).toHaveBeenCalledTimes(1)
    const [items] = vi.mocked(clipboard.write).mock.calls[0]
    expect(items).toHaveLength(1)
    expect(items[0]).toBeInstanceOf(ClipboardItem)
    expect(items[0].types).toEqual(['image/png'])
    const blob = await items[0].getType('image/png')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('finishes the clipboard write before running the next function-tool action', async () => {
    const { clipboard, shell } = await import('electron')
    mockTools.listTools.mockReturnValue([
      { id: 'fn-1', tool_type: 'function', value: 'copy("hello"); openLink("https://example.com");' }
    ])
    let resolveWrite!: () => void
    vi.mocked(clipboard.writeText).mockReturnValueOnce(new Promise<void>((r) => { resolveWrite = r }))

    const pending = invoke('tool:executeFunction', { id: 'fn-1', paramValues: {} })
    await Promise.resolve()

    expect(clipboard.writeText).toHaveBeenCalledWith('hello')
    expect(shell.openExternal).not.toHaveBeenCalled()

    resolveWrite()
    await pending
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
  })
})
