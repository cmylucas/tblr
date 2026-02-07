import { showOverlay, hideOverlay, getOverlayWindow } from './windowManager'
import { getActiveWindow, isOurApp, isChrome, isGoogleSheetsTitle, getChromeActiveTabUrl, extractSheetsUrl } from './platform'
import { isSheetAttached } from './ipc'

let intervalId: ReturnType<typeof setInterval> | null = null

// Debounce: track the last detected URL so we don't spam the renderer
let lastDetectedUrl: string | null = null
// Cooldown: don't re-send after the user dismisses (reset when URL changes)
let dismissedUrl: string | null = null

export function startWatcher(): void {
  if (intervalId) return

  intervalId = setInterval(async () => {
    try {
      const win = await getActiveWindow()

      if (!win) {
        hideOverlay()
        return
      }

      // If our own app is focused (user clicked the overlay), keep it visible
      if (isOurApp(win.appName)) {
        return
      }

      if (!isChrome(win.appName)) {
        hideOverlay()
        return
      }

      if (isGoogleSheetsTitle(win.windowTitle)) {
        showOverlay()

        // Auto-detect sheet URL if no sheet is currently attached
        if (!isSheetAttached()) {
          try {
            const chromeUrl = await getChromeActiveTabUrl()
            if (chromeUrl) {
              const sheetsUrl = extractSheetsUrl(chromeUrl)
              if (sheetsUrl && sheetsUrl !== lastDetectedUrl && sheetsUrl !== dismissedUrl) {
                lastDetectedUrl = sheetsUrl
                // Send to renderer for user confirmation
                const overlay = getOverlayWindow()
                if (overlay && !overlay.isDestroyed()) {
                  overlay.webContents.send('sheet:detected', sheetsUrl)
                  console.log(`[windowWatcher] detected sheets URL: ${sheetsUrl}`)
                }
              }
            }
          } catch {
            // Non-critical — URL detection failed silently
          }
        } else {
          // Sheet is attached, reset detection state
          lastDetectedUrl = null
          dismissedUrl = null
        }
      } else {
        hideOverlay()
      }
    } catch {
      // Silently ignore
    }
  }, 500)

  console.log('[windowWatcher] started polling every 500ms')
}

export function stopWatcher(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[windowWatcher] stopped')
  }
}

/** Called when user dismisses a detected URL, so we don't keep re-prompting */
export function dismissDetectedUrl(url: string): void {
  dismissedUrl = url
  if (lastDetectedUrl === url) lastDetectedUrl = null
}
