// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockBrowserWindow, makeWindow } = vi.hoisted(() => {
  const makeWindow = () => ({
    on: vi.fn(),
    once: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    setTitle: vi.fn(),
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    webContents: { setWindowOpenHandler: vi.fn(), on: vi.fn(), send: vi.fn() }
  })
  const mockBrowserWindow = vi.fn(function () { return makeWindow() })
  return { mockBrowserWindow, makeWindow }
})

vi.mock('electron', () => ({
  BrowserWindow: mockBrowserWindow,
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) },
  app: {
    getPath: () => '/tmp',
    setActivationPolicy: vi.fn(),
    dock: { hide: vi.fn(), show: vi.fn() }
  },
  ipcMain: { once: vi.fn() }
}))

vi.mock('child_process', () => ({
  default: { exec: vi.fn() },
  exec: vi.fn()
}))

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => { throw new Error('not found') }),
    writeFileSync: vi.fn()
  },
  readFileSync: vi.fn(() => { throw new Error('not found') }),
  writeFileSync: vi.fn()
}))

const originalPlatform = process.platform

function setPlatform(platform: string): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

function constructorOptions(call: number): Record<string, unknown> {
  return mockBrowserWindow.mock.calls[call][0] as Record<string, unknown>
}

describe('overlay windows on macOS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    setPlatform('darwin')
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it.each([
    ['createOverlayWindow'],
    ['createToolkitOverlayWindow'],
    ['createTokeniserOverlayWindow']
  ])('%s creates a non-activating panel so showing it never activates the app', async (fn) => {
    const windows = await import('../windows')
    ;(windows as unknown as Record<string, () => void>)[fn]()
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1)
    expect(constructorOptions(0).type).toBe('panel')
  })

  it('still asks for all-workspaces visibility above fullscreen apps', async () => {
    const { createOverlayWindow } = await import('../windows')
    const win = createOverlayWindow() as unknown as ReturnType<typeof makeWindow>
    expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, { visibleOnFullScreen: true })
  })

  it('does not make the manager window a panel', async () => {
    const { createManagerWindow } = await import('../windows')
    createManagerWindow()
    expect(constructorOptions(0).type).toBeUndefined()
  })
})

describe('overlay windows on other platforms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    setPlatform('win32')
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it('does not request the macOS-only panel type', async () => {
    const { createOverlayWindow } = await import('../windows')
    createOverlayWindow()
    expect(constructorOptions(0).type).toBeUndefined()
  })
})
