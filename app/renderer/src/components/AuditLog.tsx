import React, { useEffect, useState, useCallback } from 'react'
import type { AuditEntry } from '../../../main/shared/types'

const api = window.sheetsOverlay

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const res = await api.getAuditLog()
    if (res.ok && res.data) setEntries(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh])

  if (loading) {
    return <div style={styles.empty}>Loading logs...</div>
  }

  if (entries.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" opacity="0.25">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 9h-2V9h2v2zm0 4h-2v-2h2v2zm-3-6V3.5L16.5 10H10z" />
          </svg>
        </div>
        <div style={{ opacity: 0.4, fontSize: 12 }}>No log entries yet</div>
        <div style={{ opacity: 0.25, fontSize: 11 }}>Actions will appear here as you use the chat.</div>
      </div>
    )
  }

  return (
    <div style={styles.list}>
      {entries.map((entry) => (
        <div key={entry.id} style={styles.entry}>
          <div style={styles.entryHeader}>
            <span
              style={{
                ...styles.statusBadge,
                background: entry.success ? 'rgba(46,204,64,0.15)' : 'rgba(255,68,68,0.15)',
                color: entry.success ? '#2ecc40' : '#ff4444',
              }}
            >
              {entry.success ? 'OK' : 'ERR'}
            </span>
            <span style={styles.operation}>{entry.operation}</span>
            <span style={styles.time}>{formatTime(entry.timestamp)}</span>
          </div>
          {entry.message && (
            <div style={styles.message}>{entry.message}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 10px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
    padding: '40px 20px',
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entry: {
    padding: '6px 8px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    fontSize: 8,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 3,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  operation: {
    fontSize: 11,
    fontWeight: 600,
    opacity: 0.8,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  time: {
    fontSize: 9,
    opacity: 0.35,
    flexShrink: 0,
    fontFamily: 'monospace',
  },
  message: {
    fontSize: 10,
    opacity: 0.45,
    marginTop: 3,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    userSelect: 'text',
    cursor: 'text',
  },
}
