import { showOverlay, hideOverlay } from './windowManager'
import { getActiveWindow, isOurApp, isChrome, isGoogleSheetsTitle } from './platform'

let intervalId: ReturnType<typeof setInterval> | null = null

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
