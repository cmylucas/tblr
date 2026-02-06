import { exec } from 'child_process'
import { showOverlay, hideOverlay } from './windowManager'

let intervalId: ReturnType<typeof setInterval> | null = null

/**
 * Get active window info on macOS using osascript (AppleScript).
 * Returns { appName, windowTitle } or null.
 */
function getActiveWindow(): Promise<{ appName: string; windowTitle: string } | null> {
  return new Promise((resolve) => {
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
      end tell
      tell application frontApp
        try
          set winTitle to name of front window
        on error
          set winTitle to ""
        end try
      end tell
      return frontApp & "|||" & winTitle
    `
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 2000 }, (err, stdout) => {
      if (err) {
        resolve(null)
        return
      }
      const parts = stdout.trim().split('|||')
      if (parts.length >= 2) {
        resolve({ appName: parts[0], windowTitle: parts.slice(1).join('|||') })
      } else {
        resolve(null)
      }
    })
  })
}

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
      if (win.appName === 'Electron' || win.appName === 'Sheets Overlay') {
        return
      }

      if (win.appName !== 'Google Chrome') {
        hideOverlay()
        return
      }

      if (/google\s*sheets|sheets/i.test(win.windowTitle)) {
        showOverlay()
      } else {
        hideOverlay()
      }
    } catch (err) {
      // Silently ignore
    }
  }, 500)

  console.log('[windowWatcher] started polling every 500ms (using osascript)')
}

export function stopWatcher(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[windowWatcher] stopped')
  }
}
