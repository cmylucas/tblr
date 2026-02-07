import React from 'react'
import type { AuditEntry } from '../../../main/shared/types'

interface Props {
  entries: AuditEntry[]
}

export default function AuditLog({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={{ opacity: 0.3, fontSize: 12 }}>No log entries yet</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.label}>Activity Log</div>
      <div style={styles.list}>
        {entries.map((e) => (
          <div key={e.id} style={styles.row}>
            <div style={styles.rowTop}>
              <span
                style={{
                  ...styles.indicator,
                  background: e.success ? 'rgba(46,204,64,0.15)' : 'rgba(255,68,68,0.15)',
                  color: e.success ? '#2ecc40' : '#ff4444',
                }}
              >
                {e.success ? 'OK' : 'ERR'}
              </span>
              <span style={styles.operation}>{e.operation}</span>
              <span style={styles.time}>{new Date(e.timestamp).toLocaleTimeString()}</span>
            </div>
            <div style={styles.rowDetails}>
              {e.range && <span style={styles.detail}>{e.range}</span>}
              {e.rowCount !== undefined && (
                <span style={styles.detail}>
                  {e.rowCount}r x {e.colCount ?? 0}c
                </span>
              )}
              {e.message && <span style={styles.detail}>{e.message}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.45,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  rowTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  indicator: {
    fontSize: 9,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  operation: {
    fontSize: 12,
    fontWeight: 600,
    flex: 1,
  },
  time: {
    fontSize: 10,
    opacity: 0.35,
  },
  rowDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 2,
  },
  detail: {
    fontSize: 10,
    opacity: 0.5,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
}
