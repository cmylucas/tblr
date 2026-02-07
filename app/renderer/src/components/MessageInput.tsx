import React, { useState, useRef, useEffect } from 'react'
import type { AttachmentMeta } from '../../../main/attachments/types'
import type { DatasetMeta } from '../../../main/datasets/datasetTypes'

export interface AttachedFile {
  name: string
  path: string
  size: number
}

interface Props {
  onSend: (text: string) => void
  onAttachFile: () => void
  onAbort: () => void
  disabled: boolean
  attachedFiles: AttachmentMeta[]
  attachedDatasets?: DatasetMeta[]
  onRemoveAttachment: (fileId: string) => void
  onRemoveDataset?: (datasetId: string) => void
}

export default function MessageInput({ onSend, onAttachFile, onAbort, disabled, attachedFiles, attachedDatasets, onRemoveAttachment, onRemoveDataset }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [hoverAttach, setHoverAttach] = useState(false)

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [disabled])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const typeIcon = (type: string) => {
    if (type === 'pdf') return { color: 'rgba(255,100,100,0.7)', label: 'PDF' }
    return { color: 'rgba(100,200,100,0.7)', label: type.toUpperCase() }
  }

  return (
    <div style={styles.container}>
      {/* Attached file chips */}
      {attachedFiles.length > 0 && (
        <div style={styles.chipsRow}>
          {attachedFiles.map((f) => {
            const ti = typeIcon(f.type)
            return (
              <div key={f.fileId} style={styles.fileChip}>
                <span style={{ ...styles.typeBadge, color: ti.color }}>{ti.label}</span>
                <span style={styles.fileName}>{f.name}</span>
                <span style={styles.fileSize}>{formatFileSize(f.sizeBytes)}</span>
                <button onClick={() => onRemoveAttachment(f.fileId)} style={styles.fileRemoveBtn}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Attached dataset chips */}
      {attachedDatasets && attachedDatasets.length > 0 && (
        <div style={styles.chipsRow}>
          {attachedDatasets.map((ds) => {
            const sourceIcon = ds.source.type === 'sec-filing' ? '🏛️' : '📊'
            return (
              <div key={ds.datasetId} style={styles.datasetChip}>
                <span style={styles.datasetIcon}>{sourceIcon}</span>
                <span style={styles.fileName}>{ds.name}</span>
                <span style={styles.fileSize}>{ds.stats.rowCount.toLocaleString()} rows</span>
                {onRemoveDataset && (
                  <button onClick={() => onRemoveDataset(ds.datasetId)} style={styles.fileRemoveBtn}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={styles.inputRow}>
        {/* Attach button — uses native dialog via IPC */}
        <button
          style={{
            ...styles.attachBtn,
            background: hoverAttach ? 'rgba(255,255,255,0.1)' : 'transparent',
          }}
          onMouseEnter={() => setHoverAttach(true)}
          onMouseLeave={() => setHoverAttach(false)}
          onClick={onAttachFile}
          disabled={disabled}
          title="Attach file (PDF, CSV, TSV)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff" style={{ opacity: disabled ? 0.3 : 0.85 }}>
            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          style={styles.textarea}
          placeholder={disabled ? 'Waiting for response...' : 'Ask about your spreadsheet...'}
          value={text}
          onChange={(e) => { setText(e.target.value); handleInput() }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        {disabled ? (
          <button
            style={{
              ...styles.sendBtn,
              background: 'rgba(255,68,68,0.7)',
              cursor: 'pointer',
            }}
            onClick={onAbort}
            title="Stop AI"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            style={{
              ...styles.sendBtn,
              background: text.trim() ? 'rgba(29,185,84,0.85)' : 'rgba(255,255,255,0.06)',
              cursor: text.trim() ? 'pointer' : 'default',
            }}
            onClick={handleSend}
            disabled={!text.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>
      <div style={styles.hint}>Enter to send, Shift+Enter for newline</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flexShrink: 0,
    padding: '8px 12px 10px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    background: 'rgba(0,0,0,0.1)',
  },
  chipsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 6,
  },
  fileChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    borderRadius: 8,
    background: 'rgba(29, 185, 84, 0.1)',
    border: '1px solid rgba(29, 185, 84, 0.2)',
  },
  typeBadge: {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  fileName: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  fileSize: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    flexShrink: 0,
  },
  fileRemoveBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: 4,
  },
  datasetChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    borderRadius: 8,
    background: 'rgba(100, 150, 255, 0.1)',
    border: '1px solid rgba(100, 150, 255, 0.2)',
  },
  datasetIcon: {
    fontSize: 12,
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'flex-end',
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  textarea: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(29,185,84,0.15)',
    background: 'rgba(0,0,0,0.25)',
    color: '#e0e0e0',
    fontSize: 12,
    outline: 'none',
    resize: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    lineHeight: 1.4,
    boxSizing: 'border-box' as const,
    overflowY: 'auto',
    maxHeight: 120,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  hint: {
    fontSize: 9,
    opacity: 0.2,
    marginTop: 4,
    textAlign: 'center' as const,
  },
}
