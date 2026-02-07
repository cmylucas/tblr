import { app, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { IPC, type AuditEntry, type AppStatus, type IpcResult, type ChatMessage, type ChatResponse } from './shared/types'
import { AttachSheetInput } from './shared/schema'
import { signIn, signOut, isSignedIn, getEmail, tryRestoreSession } from './auth/googleAuth'
import { parseSheetUrl } from './sheets/parseSheetUrl'
import { getSpreadsheetMetadata } from './sheets/sheetsClient'
import { runAgent } from './llm/agent'
import { dismissDetectedUrl } from './windowWatcher'
import { registerAttachmentHandlers } from './attachments/attachmentsIpc'
import { registerDatasetHandlers } from './datasets/datasetsIpc'
import { registerTemplateIpcHandlers } from './templates/templatesIpc'
import { getOAuth2Client } from './auth/googleAuth'

// ── App state ──

let currentSpreadsheetId: string | undefined
let currentSpreadsheetTitle: string | undefined
let currentSheetNames: string[] = []
const auditLog: AuditEntry[] = []
let chatAbortController: AbortController | null = null

export function isSheetAttached(): boolean {
  return !!currentSpreadsheetId
}

function addAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  const full: AuditEntry = {
    ...entry,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  }
  auditLog.unshift(full)
  if (auditLog.length > 100) auditLog.length = 100
  console.log(`[audit] ${full.operation} ok=${full.success} ${full.message ?? ''}`)
}

// ── Handlers ──

export function registerIpcHandlers(): void {
  tryRestoreSession().catch(() => {})

  ipcMain.handle(IPC.GET_STATUS, async (): Promise<IpcResult<AppStatus>> => {
    return {
      ok: true,
      data: {
        signedIn: isSignedIn(),
        email: getEmail(),
        attached: !!currentSpreadsheetId,
        spreadsheetId: currentSpreadsheetId,
        spreadsheetTitle: currentSpreadsheetTitle,
        sheetNames: currentSheetNames,
      },
    }
  })

  ipcMain.handle(IPC.GET_AUDIT_LOG, async (): Promise<IpcResult<AuditEntry[]>> => {
    return { ok: true, data: auditLog }
  })

  ipcMain.handle(IPC.ATTACH_SHEET, async (_e, rawUrl: string): Promise<IpcResult<{ spreadsheetId: string; title: string; sheetNames: string[] }>> => {
    try {
      const { url } = AttachSheetInput.parse({ url: rawUrl })
      const { spreadsheetId } = parseSheetUrl(url)

      if (!isSignedIn()) {
        addAudit({ operation: 'attach', spreadsheetId, success: false, message: 'Not signed in' })
        return { ok: false, error: 'Not signed in. Please sign in first.' }
      }

      const meta = await getSpreadsheetMetadata(spreadsheetId)
      currentSpreadsheetId = spreadsheetId
      currentSpreadsheetTitle = meta.title
      currentSheetNames = meta.sheetNames

      addAudit({ operation: 'attach', spreadsheetId, success: true, message: `"${meta.title}" — ${meta.sheetNames.length} sheets` })
      return { ok: true, data: { spreadsheetId, title: meta.title, sheetNames: meta.sheetNames } }
    } catch (err: any) {
      addAudit({ operation: 'attach', success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.SIGN_IN, async (): Promise<IpcResult<string>> => {
    try {
      const email = await signIn()
      addAudit({ operation: 'signIn', success: true, message: email ?? 'signed in' })
      return { ok: true, data: email }
    } catch (err: any) {
      addAudit({ operation: 'signIn', success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.SIGN_OUT, async (): Promise<IpcResult> => {
    try {
      await signOut()
      currentSpreadsheetId = undefined
      currentSpreadsheetTitle = undefined
      currentSheetNames = []
      addAudit({ operation: 'signOut', success: true })
      return { ok: true }
    } catch (err: any) {
      addAudit({ operation: 'signOut', success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  // ── Chat ──

  // ── Quit ──
  ipcMain.on('app:quit', () => {
    app.quit()
  })

  // ── Dismiss detected sheet URL ──
  ipcMain.on('sheet:dismiss', (_e, url: string) => {
    dismissDetectedUrl(url)
  })

  ipcMain.handle(
    IPC.CHAT_SEND,
    async (_e, history: ChatMessage[], userText: string, modelTier?: string): Promise<IpcResult<ChatResponse>> => {
      try {
        const fullHistory: ChatMessage[] = [
          ...history,
          { role: 'user', content: userText },
        ]

        const sender = _e.sender
        const onProgress = (status: string) => {
          try { sender.send('chat:progress', status) } catch { /* window may have closed */ }
        }

        chatAbortController = new AbortController()
        const response = await runAgent(fullHistory, currentSpreadsheetId, currentSheetNames, modelTier || undefined, onProgress, chatAbortController.signal)
        chatAbortController = null

        // Log actions to audit
        for (const action of response.actions) {
          addAudit({
            operation: `tool:${action.tool}`,
            spreadsheetId: currentSpreadsheetId,
            success: action.success,
            message: action.success
              ? `${action.tool}(${JSON.stringify(action.args).substring(0, 80)})`
              : action.result.substring(0, 100),
          })
        }

        // Refresh sheet names after any modifications
        if (currentSpreadsheetId && response.actions.some((a) => a.success)) {
          try {
            const meta = await getSpreadsheetMetadata(currentSpreadsheetId)
            currentSheetNames = meta.sheetNames
            currentSpreadsheetTitle = meta.title
          } catch {
            // non-critical
          }
        }

        return { ok: true, data: response }
      } catch (err: any) {
        chatAbortController = null
        if (err.name === 'AbortError') {
          return { ok: true, data: { message: '(Stopped by user.)', actions: [] } }
        }
        console.error('[chat] error:', err)
        addAudit({ operation: 'chat', success: false, message: err.message })
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.on('chat:abort', () => {
    if (chatAbortController) {
      console.log('[chat] aborting agent')
      chatAbortController.abort()
      chatAbortController = null
    }
  })

  // ── Attachments ──
  registerAttachmentHandlers(
    addAudit,
    () => currentSpreadsheetId,
    () => currentSheetNames
  )

  // ── Datasets ──
  registerDatasetHandlers(
    addAudit,
    () => currentSpreadsheetId,
    () => currentSheetNames
  )

  // ── Templates ──
  registerTemplateIpcHandlers(() => {
    try {
      return isSignedIn() ? getOAuth2Client() : null
    } catch {
      return null
    }
  })

  console.log('[ipc] all handlers registered')
}
