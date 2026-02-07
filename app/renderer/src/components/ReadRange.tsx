import React, { useState } from 'react'
import { sectionStyle, btnPrimaryStyle, inputStyle, labelStyle } from './styles'

const api = window.sheetsOverlay

interface Props {
  onAction: () => void
  onError: (msg: string) => void
}

export default function ReadRange({ onAction, onError }: Props) {
  const [range, setRange] = useState('Sheet1!A1:D10')
  const [data, setData] = useState<string[][] | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRead = async () => {
    if (!range.trim()) return
    setLoading(true)
    try {
      const res = await api.readRange(range.trim())
      if (res.ok && res.data) {
        setData(res.data)
      } else {
        onError(res.error ?? 'Read failed')
      }
      onAction()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={labelStyle}>Read Range</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          style={inputStyle}
          placeholder="Sheet1!A1:D10"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRead()}
        />
        <button onClick={handleRead} disabled={loading} style={btnPrimaryStyle}>
          {loading ? '...' : 'Read'}
        </button>
      </div>
      {data && data.length > 0 && (
        <div style={{ overflowX: 'auto', maxHeight: 180, overflowY: 'auto' }}>
          <table style={tableStyle}>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={cellStyle}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.length === 0 && (
        <div style={{ fontSize: 11, opacity: 0.5 }}>No data in range.</div>
      )}
    </div>
  )
}

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  fontSize: 11,
  width: '100%',
}

const cellStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.06)',
  padding: '3px 6px',
  whiteSpace: 'nowrap',
  maxWidth: 120,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
