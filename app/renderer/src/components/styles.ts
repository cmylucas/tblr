import type { CSSProperties } from 'react'

export const sectionStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 8,
  padding: '8px 10px',
}

export const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  opacity: 0.5,
  marginBottom: 6,
}

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(0,0,0,0.3)',
  color: '#e0e0e0',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
}

export const btnStyle: CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  border: 'none',
  background: '#0a84ff',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 48,
  fontFamily: 'monospace',
}
