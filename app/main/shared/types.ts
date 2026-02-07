// ── Domain types ──

export interface AuditEntry {
  id: string
  timestamp: string
  operation: string
  spreadsheetId?: string
  range?: string
  rowCount?: number
  colCount?: number
  success: boolean
  message?: string
}

export interface AppStatus {
  signedIn: boolean
  email?: string
  attached: boolean
  spreadsheetId?: string
  spreadsheetTitle?: string
  sheetNames?: string[]
}

// ── Chat types ──

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ToolAction {
  tool: string
  args: Record<string, unknown>
  result: string
  success: boolean
}

export interface ChatResponse {
  message: string
  actions: ToolAction[]
}

// ── IPC channel names ──

export const IPC = {
  ATTACH_SHEET: 'sheets:attach',
  SIGN_IN: 'auth:signIn',
  SIGN_OUT: 'auth:signOut',
  GET_STATUS: 'app:getStatus',
  GET_AUDIT_LOG: 'app:getAuditLog',
  CHAT_SEND: 'chat:send',
} as const

// ── IPC response wrapper ──

export interface IpcResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
