import type { IpcResult, AppStatus, AuditEntry, ChatMessage, ChatResponse } from '../../main/shared/types'
import type { AttachmentMeta, AttachmentPreview, AttachmentChunk, ImportResult } from '../../main/attachments/types'
import type { DatasetMeta } from '../../main/datasets/datasetTypes'
import type { TemplateMeta, TemplateRun } from '../../main/templates/templateTypes'

interface SheetsOverlayAPI {
  getStatus(): Promise<IpcResult<AppStatus>>
  getAuditLog(): Promise<IpcResult<AuditEntry[]>>
  attachSheet(url: string): Promise<IpcResult<{ spreadsheetId: string; title: string; sheetNames: string[] }>>
  signIn(): Promise<IpcResult<string>>
  signOut(): Promise<IpcResult>
  sendChat(history: ChatMessage[], userText: string, modelTier?: string): Promise<IpcResult<ChatResponse>>
  collapseOverlay(): void
  quitApp(): void
  onChatProgress(cb: (status: string) => void): () => void
  onSheetDetected(cb: (url: string) => void): () => void
  dismissDetectedSheet(url: string): void
  abortChat(): void
  // Attachment APIs
  openAttachmentDialog(): Promise<IpcResult<AttachmentMeta>>
  getAttachmentPreview(fileId: string): Promise<IpcResult<AttachmentPreview>>
  readAttachmentChunk(fileId: string, cursor: any): Promise<IpcResult<AttachmentChunk>>
  importCsvToSheet(fileId: string, sheetName: string, firstRowIsHeader?: boolean): Promise<IpcResult<ImportResult>>
  listAttachments(): Promise<IpcResult<AttachmentMeta[]>>
  removeAttachment(fileId: string): Promise<IpcResult>
  // Dataset APIs
  openDatasetUploadDialog(): Promise<IpcResult<DatasetMeta>>
  submitTickerForDataset(pdfPath: string, filename: string, ticker: string): Promise<IpcResult<DatasetMeta>>
  listDatasets(): Promise<IpcResult<DatasetMeta[]>>
  getDatasetPreview(datasetId: string): Promise<IpcResult<AttachmentPreview>>
  readDatasetChunk(datasetId: string, cursor: any): Promise<IpcResult<AttachmentChunk>>
  importDatasetToSheet(datasetId: string, sheetName: string): Promise<IpcResult<ImportResult>>
  deleteDataset(datasetId: string): Promise<IpcResult>
  buildDatasetDb(datasetId: string): Promise<IpcResult>
  // Template APIs
  openTemplateUploadDialog(templateName: string, category: string): Promise<IpcResult<TemplateMeta>>
  uploadTemplate(xlsxPath: string, templateName: string, category?: string): Promise<IpcResult<{ template: TemplateMeta; validation: { valid: boolean; missingRequired: string[] } }>>
  listTemplates(): Promise<IpcResult<TemplateMeta[]>>
  getTemplate(templateId: string): Promise<IpcResult<TemplateMeta>>
  deleteTemplate(templateId: string): Promise<IpcResult>
  listTemplateRuns(templateId?: string): Promise<IpcResult<TemplateRun[]>>
  getTemplateRun(runId: string): Promise<IpcResult<TemplateRun>>
}

declare global {
  interface Window {
    sheetsOverlay: SheetsOverlayAPI
  }
}
