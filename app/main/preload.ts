import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from './shared/types'

const api = {
  getStatus: () => ipcRenderer.invoke(IPC.GET_STATUS),
  getAuditLog: () => ipcRenderer.invoke(IPC.GET_AUDIT_LOG),
  attachSheet: (url: string) => ipcRenderer.invoke(IPC.ATTACH_SHEET, url),
  signIn: () => ipcRenderer.invoke(IPC.SIGN_IN),
  signOut: () => ipcRenderer.invoke(IPC.SIGN_OUT),
  readRange: (range: string) => ipcRenderer.invoke(IPC.READ_RANGE, range),
  writeRange: (range: string, rawText: string) =>
    ipcRenderer.invoke(IPC.WRITE_RANGE, range, rawText),
  // Window control
  collapseOverlay: () => ipcRenderer.send('overlay:collapse'),
}

contextBridge.exposeInMainWorld('sheetsOverlay', api)

export type SheetsOverlayAPI = typeof api
