import type { IpcResult, AppStatus, AuditEntry } from '../../main/shared/types'

interface SheetsOverlayAPI {
  getStatus(): Promise<IpcResult<AppStatus>>
  getAuditLog(): Promise<IpcResult<AuditEntry[]>>
  attachSheet(url: string): Promise<IpcResult<{ spreadsheetId: string; sheetNames: string[] }>>
  signIn(): Promise<IpcResult<string>>
  signOut(): Promise<IpcResult>
  readRange(range: string): Promise<IpcResult<string[][]>>
  writeRange(range: string, rawText: string): Promise<IpcResult>
}

declare global {
  interface Window {
    sheetsOverlay: SheetsOverlayAPI
  }
}
