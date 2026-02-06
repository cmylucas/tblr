import { BrowserWindow, globalShortcut, screen } from 'electron'
import * as path from 'path'

let overlayWindow: BrowserWindow | null = null
let manualToggle = false // when true, ignore auto-show/hide

export function createOverlay(): BrowserWindow {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  const winWidth = 380
  const winHeight = 620

  overlayWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenW - winWidth - 24,
    y: Math.round((screenH - winHeight) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: true,
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  overlayWindow.setAlwaysOnTop(true, 'floating')

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  return overlayWindow
}

export function registerHotkey(): void {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!overlayWindow) return
    if (overlayWindow.isVisible()) {
      overlayWindow.hide()
      manualToggle = true
    } else {
      overlayWindow.show()
      manualToggle = true
    }
    // Reset manual toggle after 5 seconds so auto-show/hide resumes
    setTimeout(() => {
      manualToggle = false
    }, 5000)
  })
  console.log('[windowManager] hotkey Cmd+Shift+Space registered')
}

export function showOverlay(): void {
  if (manualToggle) return
  if (overlayWindow && !overlayWindow.isVisible()) {
    overlayWindow.showInactive()
  }
}

export function hideOverlay(): void {
  if (manualToggle) return
  if (overlayWindow && overlayWindow.isVisible()) {
    overlayWindow.hide()
  }
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}
