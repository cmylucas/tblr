import React, { useState } from 'react'

export default function PromptInput() {
  const [prompt, setPrompt] = useState('')
  const [hoverSend, setHoverSend] = useState(false)

  const handleSubmit = () => {
    if (!prompt.trim()) return
    // Functionality coming soon — just clear for now
    setPrompt('')
  }

  return (
    <div style={styles.container}>
      <div style={styles.label}>AI Prompt</div>
      <div style={styles.inputRow}>
        <textarea
          style={styles.textarea}
          placeholder="Ask AI to edit your sheet..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          rows={2}
        />
        <button
          style={{
            ...styles.sendBtn,
            background: prompt.trim()
              ? 'rgba(10,132,255,0.85)'
              : 'rgba(255,255,255,0.06)',
          }}
          onMouseEnter={() => setHoverSend(true)}
          onMouseLeave={() => setHoverSend(false)}
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          title="Send prompt (Enter)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
      <div style={styles.hint}>Coming soon — Shift+Enter for new line</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: '10px 12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.45,
    marginBottom: 6,
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: '#e0e0e0',
    fontSize: 12,
    outline: 'none',
    resize: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    lineHeight: 1.4,
    boxSizing: 'border-box' as const,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  hint: {
    fontSize: 10,
    opacity: 0.3,
    marginTop: 5,
    textAlign: 'center' as const,
  },
}
