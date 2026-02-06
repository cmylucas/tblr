import type { BrowserWindowConstructorOptions } from 'electron'
import { isMac } from './os'

/**
 * Returns platform-specific BrowserWindow options for the overlay.
 * Mac gets vibrancy + visibleOnAllWorkspaces; Windows gets a solid
 * semi-transparent background (true transparency is unreliable on Win).
 */
export function getOverlayOptions(
  base: BrowserWindowConstructorOptions
): BrowserWindowConstructorOptions {
  const shared: BrowserWindowConstructorOptions = {
    ...base,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: true,
  }

  if (isMac) {
    return {
      ...shared,
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      visibleOnAllWorkspaces: true,
    }
  }

  // Windows: transparent works but can be flaky; provide a fallback bg color
  return {
    ...shared,
    backgroundColor: '#00000000',
  }
}

/**
 * Platform-specific alwaysOnTop level.
 * Mac supports 'floating'; Windows only supports boolean.
 */
export function applyAlwaysOnTop(win: Electron.BrowserWindow): void {
  if (isMac) {
    win.setAlwaysOnTop(true, 'floating')
  } else {
    win.setAlwaysOnTop(true)
  }
}
