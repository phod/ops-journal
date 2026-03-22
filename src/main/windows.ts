import { BrowserWindow, screen, app } from 'electron'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1'
const devServerUrl = process.env['ELECTRON_RENDERER_URL']

let overlayWindow: BrowserWindow | null = null
let managerWindow: BrowserWindow | null = null
let toolkitOverlayWindow: BrowserWindow | null = null
let appIsQuitting = false
let previousFrontAppPromise: Promise<string | null> = Promise.resolve(null)

export async function getPreviousFrontApp(): Promise<string | null> {
  return previousFrontAppPromise
}

function capturePreviousFrontApp(): void {
  previousFrontAppPromise = new Promise((resolve) => {
    exec(
      'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\'',
      (error, stdout) => {
        resolve(error ? null : stdout.trim())
      }
    )
  })
}

export function setAppQuitting(): void {
  appIsQuitting = true
}

interface OverlayBounds { x: number; y: number; width: number; height: number }

function boundsFilePath(): string {
  return path.join(app.getPath('userData'), 'overlay-bounds.json')
}

function loadBounds(): OverlayBounds | null {
  try {
    const raw = fs.readFileSync(boundsFilePath(), 'utf-8')
    return JSON.parse(raw) as OverlayBounds
  } catch {
    return null
  }
}

function saveBounds(win: BrowserWindow): void {
  try {
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    fs.writeFileSync(boundsFilePath(), JSON.stringify({ x, y, width, height }))
  } catch {
    // ignore
  }
}

function loadWindowUrl(win: BrowserWindow, page: string): void {
  if (isDev && devServerUrl) {
    win.loadURL(`${devServerUrl}/${page}`)
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${page}`))
  }
}

function sharedWebPreferences(): Electron.WebPreferences {
  return {
    preload: path.join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true,
    nodeIntegration: false
  }
}

export function createOverlayWindow(): BrowserWindow {
  const saved = loadBounds()
  const win = new BrowserWindow({
    width: saved?.width ?? 600,
    height: saved?.height ?? 500,
    x: saved?.x,
    y: saved?.y,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true,
    show: false,
    resizable: true,
    hasShadow: true,
    webPreferences: sharedWebPreferences()
  })

  win.on('move', () => saveBounds(win))
  win.on('resize', () => saveBounds(win))

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadWindowUrl(win, 'index.html')

  overlayWindow = win
  return win
}

export function createManagerWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    titleBarStyle: 'default',
    webPreferences: sharedWebPreferences()
  })

  win.setTitle('Ops Journal — Investigations')

  // Hide instead of destroy when the user clicks the X button
  win.on('close', (e) => {
    if (!appIsQuitting) {
      e.preventDefault()
      win.hide()
      if (process.platform === 'darwin') {
        app.setActivationPolicy('accessory')
        app.dock?.hide()
      }
    }
  })

  loadWindowUrl(win, 'manager.html')

  managerWindow = win
  return win
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function getManagerWindow(): BrowserWindow | null {
  return managerWindow
}

export function navigateManagerToDetails(id: string): void {
  showManager()
  const win = managerWindow
  if (win && !win.isDestroyed()) {
    win.webContents.send('navigate:details', id)
  }
}

export function toggleOverlay(): void {
  const win = overlayWindow
  if (!win) return

  if (win.isVisible()) {
    win.hide()
  } else {
    if (!loadBounds()) positionOverlay(win)
    win.show()
    win.focus()
  }
}

export function showOverlay(): void {
  const win = overlayWindow
  if (!win) return
  if (!loadBounds()) positionOverlay(win)
  win.show()
  win.focus()
}

export function hideOverlay(): void {
  const win = overlayWindow
  if (!win) return
  win.hide()
}

export function showManager(): void {
  const win = managerWindow
  if (!win) return
  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular')
    app.dock?.show()
  }
  win.webContents.send('navigate:home')
  win.show()
  win.focus()
}

export function toggleManager(): void {
  const win = managerWindow
  if (win?.isVisible()) {
    hideManager()
  } else {
    showManager()
  }
}

export function hideManager(): void {
  const win = managerWindow
  if (!win) return
  win.hide()
  if (process.platform === 'darwin') {
    app.setActivationPolicy('accessory')
    app.dock?.hide()
  }
}

function positionOverlay(win: BrowserWindow): void {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const [width] = win.getSize()
  const x = Math.round((workAreaSize.width - width) / 2)
  const y = 80 // Near the top of the screen
  win.setPosition(x, y)
}

let preBoardBounds: OverlayBounds | null = null
let preSearchBounds: OverlayBounds | null = null

export function expandOverlayForBoard(): void {
  const win = overlayWindow
  if (!win) return
  // Save current bounds so we can restore on close
  const [x, y] = win.getPosition()
  const [currentWidth, height] = win.getSize()
  preBoardBounds = { x, y, width: currentWidth, height }

  const { workAreaSize } = screen.getPrimaryDisplay()
  const targetWidth = Math.min(Math.round(workAreaSize.width * 0.85), 1600)
  if (currentWidth < targetWidth) {
    const newX = Math.round((workAreaSize.width - targetWidth) / 2)
    win.setBounds({ x: newX, y, width: targetWidth, height })
  }
}

export function restoreOverlayFromBoard(): void {
  const win = overlayWindow
  if (!win || !preBoardBounds) return
  win.setBounds(preBoardBounds)
  preBoardBounds = null
}

export function expandOverlayForSearch(): void {
  const win = overlayWindow
  if (!win) return
  // Skip if board is already expanded (overlay already wide)
  if (preBoardBounds) return
  const [x, y] = win.getPosition()
  const [currentWidth, height] = win.getSize()
  preSearchBounds = { x, y, width: currentWidth, height }

  const { workAreaSize } = screen.getPrimaryDisplay()
  const targetWidth = Math.min(Math.round(workAreaSize.width * 0.85), 1600)
  if (currentWidth < targetWidth) {
    const newX = Math.round((workAreaSize.width - targetWidth) / 2)
    win.setBounds({ x: newX, y, width: targetWidth, height })
  }
}

export function restoreOverlayFromSearch(): void {
  const win = overlayWindow
  if (!win || !preSearchBounds) return
  win.setBounds(preSearchBounds)
  preSearchBounds = null
}

// --- Toolkit overlay ---

function toolkitBoundsFilePath(): string {
  return path.join(app.getPath('userData'), 'toolkit-overlay-bounds.json')
}

let cachedToolkitBounds: OverlayBounds | null = null

function loadToolkitBounds(): OverlayBounds | null {
  if (cachedToolkitBounds) return cachedToolkitBounds
  try {
    const raw = fs.readFileSync(toolkitBoundsFilePath(), 'utf-8')
    cachedToolkitBounds = JSON.parse(raw) as OverlayBounds
    return cachedToolkitBounds
  } catch {
    return null
  }
}

function saveToolkitBounds(win: BrowserWindow): void {
  try {
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    cachedToolkitBounds = { x, y, width, height }
    fs.writeFileSync(toolkitBoundsFilePath(), JSON.stringify(cachedToolkitBounds))
  } catch {
    // ignore
  }
}

export function createToolkitOverlayWindow(): BrowserWindow {
  const saved = loadToolkitBounds()
  const win = new BrowserWindow({
    width: saved?.width ?? 500,
    height: saved?.height ?? 400,
    x: saved?.x,
    y: saved?.y,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true,
    show: false,
    resizable: true,
    hasShadow: true,
    webPreferences: sharedWebPreferences()
  })

  win.on('move', () => saveToolkitBounds(win))
  win.on('resize', () => saveToolkitBounds(win))

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadWindowUrl(win, 'toolkit.html')

  toolkitOverlayWindow = win
  return win
}

export function getToolkitOverlayWindow(): BrowserWindow | null {
  return toolkitOverlayWindow
}

export function toggleToolkitOverlay(): void {
  const win = toolkitOverlayWindow
  if (!win) return

  if (win.isVisible()) {
    win.hide()
  } else {
    capturePreviousFrontApp()
    if (!loadToolkitBounds()) {
      const { workAreaSize } = screen.getPrimaryDisplay()
      const [width] = win.getSize()
      const x = Math.round((workAreaSize.width - width) / 2)
      win.setPosition(x, 80)
    }
    win.show()
    win.focus()
  }
}

export function showToolkitOverlay(): void {
  const win = toolkitOverlayWindow
  if (!win) return
  capturePreviousFrontApp()
  if (!loadToolkitBounds()) {
    const { workAreaSize } = screen.getPrimaryDisplay()
    const [width] = win.getSize()
    const x = Math.round((workAreaSize.width - width) / 2)
    win.setPosition(x, 80)
  }
  win.show()
  win.focus()
}

export function hideToolkitOverlay(): void {
  const win = toolkitOverlayWindow
  if (!win) return
  win.hide()
}
