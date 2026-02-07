import React, { useState } from 'react'
import { sectionStyle, btnPrimaryStyle, inputStyle, labelStyle, textareaStyle } from './styles'

const api = window.sheetsOverlay

interface Props {
  onAction: () => void
  onError: (msg: string) => void
}

export default function WriteRange({ onAction, onError }: Props) {
  const [range, setRange] = useState('Sheet1!A1')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleWrite = async () => {
    if (!range.trim() || !text.trim()) return
    setLoading(true)
    setSuccess(false)
    try {
      const res = await api.writeRange(range.trim(), text)
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
      } else {
        onError(res.error ?? 'Write failed')
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
      <div style={labelStyle}>Write Range</div>
      <input
        style={{ ...inputStyle, marginBottom: 6 }}
        placeholder="Sheet1!A1"
        value={range}
        onChange={(e) => setRange(e.target.value)}
      />
      <textarea
        style={textareaStyle}
        placeholder="Paste TSV or CSV data (rows = newlines, cols = tabs or commas)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <button onClick={handleWrite} disabled={loading} style={btnPrimaryStyle}>
          {loading ? '...' : 'Write'}
        </button>
        {success && <span style={{ fontSize: 11, color: '#2ecc40' }}>Written!</span>}
      </div>
    </div>
  )
}
