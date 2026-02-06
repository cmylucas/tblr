import { exec } from 'child_process'
import { isMac, isWindows } from './os'

export interface ActiveWindowInfo {
  appName: string
  windowTitle: string
}

// ── Active window detection ──

function getActiveWindowMac(): Promise<ActiveWindowInfo | null> {
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
      if (err) { resolve(null); return }
      const parts = stdout.trim().split('|||')
      if (parts.length >= 2) {
        resolve({ appName: parts[0], windowTitle: parts.slice(1).join('|||') })
      } else {
        resolve(null)
      }
    })
  })
}

function getActiveWindowWindows(): Promise<ActiveWindowInfo | null> {
  return new Promise((resolve) => {
    // PowerShell: get the foreground window process name and title
    const ps = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class Win32 {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        }
"@
      $hwnd = [Win32]::GetForegroundWindow()
      $sb = New-Object System.Text.StringBuilder 256
      [Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
      $title = $sb.ToString()
      $pid = 0
      [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
      $name = if ($proc) { $proc.ProcessName } else { "" }
      Write-Output "$name|||$title"
    `.trim()

    exec(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
      { timeout: 3000 },
      (err, stdout) => {
        if (err) { resolve(null); return }
        const parts = stdout.trim().split('|||')
        if (parts.length >= 2) {
          resolve({ appName: parts[0], windowTitle: parts.slice(1).join('|||') })
        } else {
          resolve(null)
        }
      }
    )
  })
}

export function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  if (isMac) return getActiveWindowMac()
  if (isWindows) return getActiveWindowWindows()
  return Promise.resolve(null)
}

// ── Detection rules ──

const CHROME_NAMES_MAC = ['Google Chrome', 'Google Chrome Canary']
const CHROME_NAMES_WIN = ['chrome', 'chrome.exe']
const SELF_NAMES_MAC = ['Electron', 'Sheets Overlay', 'sheets-overlay']
const SELF_NAMES_WIN = ['Electron', 'sheets-overlay', 'Sheets Overlay']

export function isOurApp(appName: string): boolean {
  const names = isMac ? SELF_NAMES_MAC : SELF_NAMES_WIN
  return names.some((n) => appName.toLowerCase() === n.toLowerCase())
}

export function isChrome(appName: string): boolean {
  const names = isMac ? CHROME_NAMES_MAC : CHROME_NAMES_WIN
  return names.some((n) => appName.toLowerCase() === n.toLowerCase())
}

export function isGoogleSheetsTitle(title: string): boolean {
  return /google\s*sheets|sheets/i.test(title)
}
