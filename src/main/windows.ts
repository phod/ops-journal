import { BrowserWindow, screen, app } from 'electron'
import path from 'path'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1'

let overlayWindow: BrowserWindow | null = null
let managerWindow: BrowserWindow | null = null
let appIsQuitting = false

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
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('move', () => saveBounds(win))
  win.on('resize', () => saveBounds(win))

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/index.html`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  overlayWindow = win
  return win
}

export function createManagerWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
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

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/manager.html`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/manager.html'))
  }

  managerWindow = win
  return win
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function getManagerWindow(): BrowserWindow | null {
  return managerWindow
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
  win.show()
  win.focus()
}

function positionOverlay(win: BrowserWindow): void {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const [width] = win.getSize()
  const x = Math.round((workAreaSize.width - width) / 2)
  const y = 80 // Near the top of the screen
  win.setPosition(x, y)
}
