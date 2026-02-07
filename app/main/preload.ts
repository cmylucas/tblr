import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from './shared/types'

const api = {
  getStatus: () => ipcRenderer.invoke(IPC.GET_STATUS),
  getAuditLog: () => ipcRenderer.invoke(IPC.GET_AUDIT_LOG),
  attachSheet: (url: string) => ipcRenderer.invoke(IPC.ATTACH_SHEET, url),
  signIn: () => ipcRenderer.invoke(IPC.SIGN_IN),
  signOut: () => ipcRenderer.invoke(IPC.SIGN_OUT),
  sendChat: (history: any[], userText: string, modelTier?: string) =>
    ipcRenderer.invoke(IPC.CHAT_SEND, history, userText, modelTier),
  // Window control
  collapseOverlay: () => ipcRenderer.send('overlay:collapse'),
  quitApp: () => ipcRenderer.send('app:quit'),
  // Chat progress events
  onChatProgress: (cb: (status: string) => void) => {
    const handler = (_e: any, status: string) => cb(status)
    ipcRenderer.on('chat:progress', handler)
    return () => { ipcRenderer.removeListener('chat:progress', handler) }
  },
}

contextBridge.exposeInMainWorld('sheetsOverlay', api)

export type SheetsOverlayAPI = typeof api
