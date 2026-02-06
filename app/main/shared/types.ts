// ── Domain types ──

export interface AuditEntry {
  id: string
  timestamp: string
  operation: 'attach' | 'read' | 'write' | 'signIn' | 'signOut'
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
  sheetNames?: string[]
}

// ── IPC channel names ──

export const IPC = {
  ATTACH_SHEET: 'sheets:attach',
  SIGN_IN: 'auth:signIn',
  SIGN_OUT: 'auth:signOut',
  READ_RANGE: 'sheets:readRange',
  WRITE_RANGE: 'sheets:writeRange',
  GET_STATUS: 'app:getStatus',
  GET_AUDIT_LOG: 'app:getAuditLog',
} as const

// ── IPC response wrapper ──

export interface IpcResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
