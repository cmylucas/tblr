import React, { useState } from 'react'

interface Props {
  filename: string
  onSubmit: (ticker: string) => void
  onCancel: () => void
}

export default function TickerInputModal({ filename, onSubmit, onCancel }: Props) {
  const [ticker, setTicker] = useState('')

  const handleSubmit = () => {
    if (ticker.trim()) {
      onSubmit(ticker.trim().toUpperCase())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Ticker Symbol Required</h3>
        <p style={styles.message}>
          Could not auto-detect the company ticker from <strong>{filename}</strong>.
        </p>
        <p style={styles.hint}>Please enter the ticker symbol (e.g., AAPL, TSLA, META):</p>

        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="Ticker (1-5 letters)"
          maxLength={5}
          autoFocus
          style={styles.input}
        />

        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!ticker.trim()} style={styles.submitBtn}>
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 24,
    maxWidth: 480,
    width: '90%',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: 18,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  message: {
    margin: '0 0 12px 0',
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 1.5,
  },
  hint: {
    margin: '0 0 16px 0',
    fontSize: 13,
    color: '#b0b0b0',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e0e0e0',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    outline: 'none',
  },
  actions: {
    marginTop: 20,
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    color: '#a0a0a0',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  submitBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: '#1DB954',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
    opacity: 1,
  },
}
