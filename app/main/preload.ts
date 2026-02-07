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
  // Auto-detected sheet URL events
  onSheetDetected: (cb: (url: string) => void) => {
    const handler = (_e: any, url: string) => cb(url)
    ipcRenderer.on('sheet:detected', handler)
    return () => { ipcRenderer.removeListener('sheet:detected', handler) }
  },
  dismissDetectedSheet: (url: string) => ipcRenderer.send('sheet:dismiss', url),
  abortChat: () => ipcRenderer.send('chat:abort'),
  // Attachment APIs
  openAttachmentDialog: () => ipcRenderer.invoke('attachments:openDialog'),
  getAttachmentPreview: (fileId: string) => ipcRenderer.invoke('attachments:getPreview', fileId),
  readAttachmentChunk: (fileId: string, cursor: any) => ipcRenderer.invoke('attachments:readChunk', fileId, cursor),
  importCsvToSheet: (fileId: string, sheetName: string, firstRowIsHeader?: boolean) =>
    ipcRenderer.invoke('attachments:importCsv', fileId, sheetName, firstRowIsHeader ?? true),
  listAttachments: () => ipcRenderer.invoke('attachments:list'),
  removeAttachment: (fileId: string) => ipcRenderer.invoke('attachments:remove', fileId),
  // Dataset APIs
  openDatasetUploadDialog: () => ipcRenderer.invoke('datasets:openUploadDialog'),
  submitTickerForDataset: (pdfPath: string, filename: string, ticker: string) =>
    ipcRenderer.invoke('datasets:promptTicker', pdfPath, filename, ticker),
  listDatasets: () => ipcRenderer.invoke('datasets:list'),
  getDatasetPreview: (datasetId: string) => ipcRenderer.invoke('datasets:getPreview', datasetId),
  readDatasetChunk: (datasetId: string, cursor: any) => ipcRenderer.invoke('datasets:readChunk', datasetId, cursor),
  importDatasetToSheet: (datasetId: string, sheetName: string) =>
    ipcRenderer.invoke('datasets:importToSheets', datasetId, sheetName),
  deleteDataset: (datasetId: string) => ipcRenderer.invoke('datasets:delete', datasetId),
  buildDatasetDb: (datasetId: string) => ipcRenderer.invoke('datasets:buildDb', datasetId),
  // Template APIs
  openTemplateUploadDialog: (templateName: string, category: string) =>
    ipcRenderer.invoke('templates:openUploadDialog', templateName, category),
  uploadTemplate: (xlsxPath: string, templateName: string, category?: string) =>
    ipcRenderer.invoke('templates:upload', xlsxPath, templateName, category),
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  getTemplate: (templateId: string) => ipcRenderer.invoke('templates:get', templateId),
  deleteTemplate: (templateId: string) => ipcRenderer.invoke('templates:delete', templateId),
  listTemplateRuns: (templateId?: string) => ipcRenderer.invoke('templates:listRuns', templateId),
  getTemplateRun: (runId: string) => ipcRenderer.invoke('templates:getRun', runId),
}

contextBridge.exposeInMainWorld('sheetsOverlay', api)

export type SheetsOverlayAPI = typeof api
