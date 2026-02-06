import React, { useEffect, useState, useCallback } from 'react'
import type { AppStatus, AuditEntry } from '../../main/shared/types'
import OverlayShell from './components/OverlayShell'
import AuthPanel from './components/AuthPanel'
import AttachSheet from './components/AttachSheet'
import ReadRange from './components/ReadRange'
import WriteRange from './components/WriteRange'
import AuditLog from './components/AuditLog'

const api = window.sheetsOverlay

export default function App() {
  const [status, setStatus] = useState<AppStatus>({
    signedIn: false,
    attached: false,
  })
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [error, setError] = useState<string | null>(null)

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
    <OverlayShell status={status}>
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError(null)} style={styles.dismissBtn}>
            x
          </button>
        </div>
      )}
      <AuthPanel status={status} onAction={refresh} onError={setError} />
      <AttachSheet status={status} onAction={refresh} onError={setError} />
      {status.signedIn && status.attached && (
        <>
          <ReadRange onAction={refresh} onError={setError} />
          <WriteRange onAction={refresh} onError={setError} />
        </>
      )}
      <AuditLog entries={auditLog} />
    </OverlayShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  error: {
    background: '#ff4444',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '0 0 8px',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 14,
  },
}
