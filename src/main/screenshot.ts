import { BrowserWindow, desktopCapturer, ipcMain, nativeImage, screen } from 'electron'
import { join } from 'path'
import { getOverlayWindow } from './windows'

export async function captureScreenshot(): Promise<string | null> {
  const overlayWin = getOverlayWindow()

  // Hide overlay so it doesn't appear in the screenshot
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.hide()
  }

  // Small delay to let the window hide
  await new Promise((r) => setTimeout(r, 150))

  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    })

    const source = sources[0]
    if (!source) return null

    const screenDataUrl = source.thumbnail.toDataURL()

    // Create fullscreen transparent selector window
    const selectorWin = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true
      }
    })

    selectorWin.loadFile(join(__dirname, '../renderer/screenshot.html'))
    selectorWin.setFullScreen(true)

    // Wait for window to be ready, then send screenshot data
    await new Promise<void>((resolve) => {
      selectorWin.webContents.once('did-finish-load', () => resolve())
    })

    selectorWin.webContents.send('screenshot:data', screenDataUrl)

    // Wait for selection or cancel
    const rect = await new Promise<{ x: number; y: number; width: number; height: number } | null>(
      (resolve) => {
        ipcMain.once('screenshot:selection', (_event, selection) => {
          resolve(selection)
        })
        selectorWin.once('closed', () => resolve(null))
      }
    )

    if (!selectorWin.isDestroyed()) {
      selectorWin.destroy()
    }

    if (!rect || rect.width < 1 || rect.height < 1) {
      return null
    }

    // Crop the full screenshot to the selected region
    const full = nativeImage.createFromDataURL(screenDataUrl)
    const cropped = full.crop({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    })

    return cropped.toDataURL()
  } finally {
    // Re-show overlay
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.show()
    }
  }
}
