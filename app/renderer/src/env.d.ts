import type { IpcResult, AppStatus, AuditEntry, ChatMessage, ChatResponse } from '../../main/shared/types'

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
}

declare global {
  interface Window {
    sheetsOverlay: SheetsOverlayAPI
  }
}
