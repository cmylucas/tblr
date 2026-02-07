import React, { useEffect, useState, useCallback } from 'react'
import type { AppStatus, AuditEntry } from '../../main/shared/types'
import OverlayShell from './components/OverlayShell'
import AuthPanel from './components/AuthPanel'
import AttachSheet from './components/AttachSheet'
import ReadRange from './components/ReadRange'
import WriteRange from './components/WriteRange'
import AuditLog from './components/AuditLog'
import PromptInput from './components/PromptInput'

const api = window.sheetsOverlay

type Tab = 'main' | 'logs' | 'budget'

export default function App() {
  const [status, setStatus] = useState<AppStatus>({
    signedIn: false,
    attached: false,
  })
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('main')

  const refreshStatus = useCallback(async () => {
    const res = await api.getStatus()
    if (res.ok && res.data) setStatus(res.data)
  }, [])

  const refreshAuditLog = useCallback(async () => {
    const res = await api.getAuditLog()
    if (res.ok && res.data) setAuditLog(res.data)
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([refreshStatus(), refreshAuditLog()])
  }, [refreshStatus, refreshAuditLog])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <OverlayShell status={status} activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Error banner — shows on all tabs */}
      {error && (
        <div style={styles.error}>
          <span style={styles.errorText}>{error}</span>
          <button onClick={() => setError(null)} style={styles.dismissBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      )}

      {/* ─── Home tab ─── */}
      {activeTab === 'main' && (
        <>
          <AuthPanel status={status} onAction={refresh} onError={setError} />
          <AttachSheet status={status} onAction={refresh} onError={setError} />

          {status.signedIn && status.attached && (
            <>
              <PromptInput />
              <ReadRange onAction={refresh} onError={setError} />
              <WriteRange onAction={refresh} onError={setError} />
            </>
          )}
        </>
      )}

      {/* ─── Logs tab ─── */}
      {activeTab === 'logs' && <AuditLog entries={auditLog} />}

      {/* ─── Budget tab ─── */}
      {activeTab === 'budget' && (
        <>
          {status.signedIn && status.attached ? (
            <div style={styles.budgetPlaceholder}>
              <div style={styles.placeholderIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                </svg>
              </div>
              <div style={{ opacity: 0.5, fontSize: 12, lineHeight: 1.5 }}>
                Budget Planner
              </div>
              <div style={{ opacity: 0.3, fontSize: 11 }}>
                AI-powered budget analysis coming soon
              </div>
            </div>
          ) : (
            <div style={styles.budgetPlaceholder}>
              <div style={styles.placeholderIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                </svg>
              </div>
              <div style={{ opacity: 0.5, fontSize: 12 }}>
                Sign in and attach a sheet to use Budget Planner
              </div>
            </div>
          )}
        </>
      )}
    </OverlayShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  error: {
    background: 'rgba(255,68,68,0.15)',
    border: '1px solid rgba(255,68,68,0.3)',
    color: '#ff6b6b',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    lineHeight: 1.3,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#ff6b6b',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  budgetPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: 10,
    textAlign: 'center',
  },
  placeholderIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
