import React, { useState } from 'react'
import type { AppStatus } from '../../../main/shared/types'
import { sectionStyle, btnStyle, inputStyle, labelStyle } from './styles'

const api = window.sheetsOverlay

interface Props {
  status: AppStatus
  onAction: () => void
  onError: (msg: string) => void
}

export default function AttachSheet({ status, onAction, onError }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAttach = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const res = await api.attachSheet(url.trim())
      if (!res.ok) {
        onError(res.error ?? 'Attach failed')
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
      <div style={labelStyle}>Attach Sheet</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: status.attached ? 6 : 0 }}>
        <input
          style={inputStyle}
          placeholder="Paste Google Sheets URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAttach()}
        />
        <button onClick={handleAttach} disabled={loading} style={btnStyle}>
          {loading ? '…' : 'Attach'}
        </button>
      </div>
      {status.attached && (
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          <div>ID: {status.spreadsheetId}</div>
          {status.sheetNames && status.sheetNames.length > 0 && (
            <div>Sheets: {status.sheetNames.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  )
}
