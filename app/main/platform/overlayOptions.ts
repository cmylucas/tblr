import type { BrowserWindowConstructorOptions } from 'electron'
import { isMac } from './os'

/**
 * Returns platform-specific BrowserWindow options for the overlay.
 * We use transparent:true so the CSS rgba backgrounds show the desktop through.
 * No vibrancy — it creates an opaque fill that blocks true translucency.
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
    hasShadow: false,
    backgroundColor: '#00000000',
  }

  if (isMac) {
    return {
      ...shared,
      visibleOnAllWorkspaces: true,
      // No vibrancy — it overrides transparency with an opaque fill
    }
  }

  return shared
}

/**
 * Platform-specific alwaysOnTop level.
 */
export function applyAlwaysOnTop(win: Electron.BrowserWindow): void {
  if (isMac) {
    win.setAlwaysOnTop(true, 'floating')
  } else {
    win.setAlwaysOnTop(true)
  }
}
