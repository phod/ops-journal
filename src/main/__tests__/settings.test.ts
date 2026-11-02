// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import os from 'os'
import fs from 'fs'
import path from 'path'

const tmpDir = path.join(os.tmpdir(), `ops-journal-test-${process.pid}`)

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir }
}))

// Import after mock is set up
import { getHotkey, setHotkey, DEFAULT_HOTKEY, getTokeniserHotkey, setTokeniserHotkey, DEFAULT_TOKENISER_HOTKEY } from '../settings'

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  // Reset module to clear any cached state between tests
  vi.resetModules()
})

describe('getHotkey', () => {
  it('returns the default hotkey when no settings file exists', () => {
    expect(getHotkey()).toBe(DEFAULT_HOTKEY)
  })

  it('returns the saved hotkey when settings file exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'settings.json'),
      JSON.stringify({ hotkey: 'Command+Shift+K' })
    )
    expect(getHotkey()).toBe('Command+Shift+K')
  })

  it('falls back to default if settings file is malformed', () => {
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), 'not valid json')
    expect(getHotkey()).toBe(DEFAULT_HOTKEY)
  })
})

describe('setHotkey', () => {
  it('writes the hotkey to settings.json', () => {
    setHotkey('Control+Alt+J')
    const raw = fs.readFileSync(path.join(tmpDir, 'settings.json'), 'utf-8')
    expect(JSON.parse(raw).hotkey).toBe('Control+Alt+J')
  })

  it('persists across reads', () => {
    setHotkey('Command+Option+J')
    expect(getHotkey()).toBe('Command+Option+J')
  })

  it('preserves other settings when updating hotkey', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'settings.json'),
      JSON.stringify({ hotkey: 'old', otherSetting: true })
    )
    setHotkey('new')
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(raw.hotkey).toBe('new')
    expect(raw.otherSetting).toBe(true)
  })
})

describe('tokeniser hotkey', () => {
  it('getTokeniserHotkey returns CommandOrControl+Shift+L by default', () => {
    expect(DEFAULT_TOKENISER_HOTKEY).toBe('CommandOrControl+Shift+L')
    expect(getTokeniserHotkey()).toBe('CommandOrControl+Shift+L')
  })

  it('setTokeniserHotkey writes tokeniserHotkey to settings.json and preserves other keys', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'settings.json'),
      JSON.stringify({ hotkey: 'Command+Shift+J', otherSetting: true })
    )
    setTokeniserHotkey('Control+Alt+T')
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(raw.tokeniserHotkey).toBe('Control+Alt+T')
    expect(raw.hotkey).toBe('Command+Shift+J')
    expect(raw.otherSetting).toBe(true)
    expect(getTokeniserHotkey()).toBe('Control+Alt+T')
  })
})
