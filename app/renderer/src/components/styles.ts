import type { CSSProperties } from 'react'

export const sectionStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 10,
  padding: '10px 12px',
  border: '1px solid rgba(255,255,255,0.06)',
}

export const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1,
  opacity: 0.45,
  marginBottom: 6,
}

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e0e0e0',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
}

export const btnStyle: CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: 'none',
  background: 'rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.85)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export const btnPrimaryStyle: CSSProperties = {
  ...btnStyle,
  background: 'rgba(10,132,255,0.8)',
  color: '#fff',
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 48,
  fontFamily: 'monospace',
}
