import { Tray, Menu, nativeImage, app } from 'electron'
import { showOverlay, hideOverlay, showManager, getOverlayWindow, showToolkitOverlay, hideToolkitOverlay, getToolkitOverlayWindow } from './windows'
import path from 'path'

let tray: Tray | null = null

function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources')
}

function buildIcon(): Electron.NativeImage {
  const dir = resourcesDir()
  // Load the 1x template; Electron automatically picks up the @2x variant
  const icon = nativeImage.createFromPath(path.join(dir, 'tray-iconTemplate.png'))
  icon.setTemplateImage(true)
  return icon
}

function buildMenu(): Electron.Menu {
  const overlayVisible = getOverlayWindow()?.isVisible() ?? false
  const toolkitVisible = getToolkitOverlayWindow()?.isVisible() ?? false
  return Menu.buildFromTemplate([
    {
      label: overlayVisible ? 'Close Journal' : 'Open Journal',
      accelerator: 'CommandOrControl+Shift+J',
      click: () => overlayVisible ? hideOverlay() : showOverlay()
    },
    {
      label: toolkitVisible ? 'Close Toolkit' : 'Open Toolkit',
      accelerator: 'CommandOrControl+Shift+K',
      click: () => toolkitVisible ? hideToolkitOverlay() : showToolkitOverlay()
    },
    {
      label: 'Manage Investigations',
      click: () => showManager()
    },
    { type: 'separator' },
    {
      label: 'Quit Ops Journal',
      accelerator: 'CommandOrControl+Q',
      click: () => app.quit()
    }
  ])
}

export function updateTrayMenu(): void {
  if (tray) tray.setContextMenu(buildMenu())
}

export function createTray(): Tray {
  const icon = buildIcon()

  tray = new Tray(icon)
  tray.setToolTip('Ops Journal')
  tray.setContextMenu(buildMenu())

  return tray
}

