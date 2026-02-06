import { app, globalShortcut } from 'electron'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { createOverlay, registerHotkey } from './windowManager'
import { startWatcher, stopWatcher } from './windowWatcher'
import { registerIpcHandlers } from './ipc'

app.whenReady().then(() => {
  console.log('[main] app ready')

  registerIpcHandlers()
  createOverlay()
  registerHotkey()
  startWatcher()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopWatcher()
})

// macOS: keep app running when all windows closed
app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
})
