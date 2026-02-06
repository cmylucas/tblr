import { app, globalShortcut } from 'electron'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { createOverlay, registerHotkey } from './windowManager'
import { startWatcher, stopWatcher } from './windowWatcher'
import { registerIpcHandlers } from './ipc'
import { isMac } from './platform'

app.whenReady().then(() => {
  console.log(`[main] app ready (platform: ${process.platform})`)

  registerIpcHandlers()
  createOverlay()
  registerHotkey()
  startWatcher()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopWatcher()
})

// Keep app running when all windows closed (both mac and windows —
// the overlay can be re-shown via hotkey or window watcher)
app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
})
