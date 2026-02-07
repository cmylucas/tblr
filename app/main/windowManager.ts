import { BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import * as path from 'path'
import {
  TOGGLE_OVERLAY_ACCELERATOR,
  TOGGLE_OVERLAY_LABEL,
  getOverlayOptions,
  applyAlwaysOnTop,
} from './platform'

let overlayWindow: BrowserWindow | null = null
let pillWindow: BrowserWindow | null = null
let manualHide = false // user explicitly collapsed the overlay

const OVERLAY_WIDTH = 380
const OVERLAY_HEIGHT = 620
const PILL_WIDTH = 36
const PILL_HEIGHT = 36

export function createOverlay(): BrowserWindow {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  const baseOpts = getOverlayOptions({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: screenW - OVERLAY_WIDTH - 24,
    y: Math.round((screenH - OVERLAY_HEIGHT) / 2),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Override hasShadow to remove the white border
  overlayWindow = new BrowserWindow({ ...baseOpts, hasShadow: false })
  applyAlwaysOnTop(overlayWindow)

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  // Create the pill (arrow) button — always-visible when overlay is hidden
  createPill()

  // Register IPC for collapsing from the renderer UI
  ipcMain.on('overlay:collapse', () => {
    manualHide = true
    hideOverlayAndShowPill()
  })

  return overlayWindow
}

function createPill(): void {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  pillWindow = new BrowserWindow({
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    x: screenW - PILL_WIDTH - 12,
    y: Math.round((screenH - PILL_HEIGHT) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    visibleOnAllWorkspaces: true,
    focusable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  pillWindow.setAlwaysOnTop(true, 'floating')

  const pillHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: transparent;
    overflow: hidden;
    width: 36px;
    height: 36px;
  }
  .pill {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(38, 38, 40, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .pill:hover { background: rgba(58, 58, 62, 0.95); }
  .pill svg { width: 16px; height: 16px; fill: rgba(255,255,255,0.7); }
</style>
</head>
<body>
  <div class="pill" id="btn">
    <svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
  </div>
  <script>
    document.getElementById('btn').addEventListener('click', function() {
      document.title = 'expand-overlay';
    });
  </script>
</body>
</html>`

  pillWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pillHtml)}`)

  // Listen for pill click via title change (works without nodeIntegration)
  pillWindow.on('page-title-updated', (_event, title) => {
    if (title === 'expand-overlay') {
      manualHide = false
      showOverlayAndHidePill()
    }
  })

  pillWindow.on('closed', () => {
    pillWindow = null
  })

  // Start hidden — overlay is shown first
  pillWindow.hide()
}

export function registerHotkey(): void {
  globalShortcut.register(TOGGLE_OVERLAY_ACCELERATOR, () => {
    if (!overlayWindow) return
    if (overlayWindow.isVisible()) {
      manualHide = true
      hideOverlayAndShowPill()
    } else {
      manualHide = false
      showOverlayAndHidePill()
    }
  })
  console.log(`[windowManager] hotkey ${TOGGLE_OVERLAY_LABEL} registered`)
}

function showOverlayAndHidePill(): void {
  if (overlayWindow && !overlayWindow.isVisible()) {
    overlayWindow.showInactive()
  }
  if (pillWindow && pillWindow.isVisible()) {
    pillWindow.hide()
  }
}

function hideOverlayAndShowPill(): void {
  if (overlayWindow && overlayWindow.isVisible()) {
    overlayWindow.hide()
  }
  if (pillWindow && !pillWindow.isVisible()) {
    pillWindow.showInactive()
  }
}

/** Called by the watcher when Google Sheets becomes the active window */
export function showOverlay(): void {
  // When Sheets becomes active, auto-expand even if user previously collapsed
  manualHide = false
  showOverlayAndHidePill()
}

/** Called by the watcher when leaving Google Sheets */
export function hideOverlay(): void {
  if (manualHide) return // already collapsed by user, pill is already showing
  hideOverlayAndShowPill()
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}
