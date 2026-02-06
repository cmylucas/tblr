import React from 'react'
import type { AuditEntry } from '../../../main/shared/types'
import { sectionStyle, labelStyle } from './styles'

interface Props {
  entries: AuditEntry[]
}

export default function AuditLog({ entries }: Props) {
  if (entries.length === 0) return null

  return (
    <div style={sectionStyle}>
      <div style={labelStyle}>Audit Log</div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {entries.map((e) => (
          <div key={e.id} style={rowStyle}>
            <span style={{ color: e.success ? '#2ecc40' : '#ff4444', fontWeight: 700, marginRight: 6 }}>
              {e.success ? '✓' : '✗'}
            </span>
            <span style={{ fontWeight: 600, marginRight: 4 }}>{e.operation}</span>
            {e.range && <span style={{ opacity: 0.7, marginRight: 4 }}>{e.range}</span>}
            {e.rowCount !== undefined && (
              <span style={{ opacity: 0.5, marginRight: 4 }}>
                {e.rowCount}r×{e.colCount ?? 0}c
              </span>
            )}
            {e.message && <span style={{ opacity: 0.6, fontSize: 10 }}>{e.message}</span>}
            <span style={{ marginLeft: 'auto', opacity: 0.4, fontSize: 10 }}>
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 11,
  padding: '3px 0',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexWrap: 'wrap',
  gap: 2,
}
