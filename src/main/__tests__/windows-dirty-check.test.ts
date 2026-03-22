import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIpcMainOnce = vi.fn()
const mockWebContentsSend = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) },
  app: {
    getPath: () => '/tmp',
    setActivationPolicy: vi.fn(),
    dock: { hide: vi.fn(), show: vi.fn() }
  },
  ipcMain: {
    once: mockIpcMainOnce
  }
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

vi.mock('path', () => ({
  default: { join: (...args: string[]) => args.join('/') },
  join: (...args: string[]) => args.join('/')
}))

describe('checkManagerDirty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('resolves true when manager window is null', async () => {
    const { checkManagerDirty } = await import('../windows')
    // managerWindow is null initially
    const result = await checkManagerDirty()
    expect(result).toBe(true)
  })
})
