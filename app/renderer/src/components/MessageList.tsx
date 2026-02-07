import React, { useEffect, useRef, useState } from 'react'
import type { ToolAction } from '../../../main/shared/types'

export interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: ToolAction[]
  timestamp: number
}

interface Props {
  messages: DisplayMessage[]
  loading: boolean
  loadingStatus?: string
}

export default function MessageList({ messages, loading, loadingStatus }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  if (messages.length === 0 && !loading) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" opacity="0.25">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
        </div>
        <div style={{ opacity: 0.4, fontSize: 12, lineHeight: 1.5 }}>
          Ask me anything about your spreadsheet.
        </div>
        <div style={{ opacity: 0.25, fontSize: 11, lineHeight: 1.4, maxWidth: 260, textAlign: 'center' }}>
          Try: "List my sheets", "Add a sheet called Dashboard", "Write headers to A1:D1"
        </div>
      </div>
    )
  }

  return (
    <div style={styles.list}>
      {messages.map((msg) => (
        <div key={msg.id} style={msg.role === 'user' ? styles.userMsg : styles.assistantMsg}>
          <div style={styles.msgContent}>{msg.content}</div>
          {msg.actions && msg.actions.length > 0 && (
            <ActionsDrawer actions={msg.actions} />
          )}
        </div>
      ))}
      {loading && (
        <div style={styles.assistantMsg}>
          <div style={styles.thinking}>
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 6 }}>
              {loadingStatus === 'applying' ? 'Applying changes' : 'Thinking'}
            </span>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

function ActionsDrawer({ actions }: { actions: ToolAction[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={styles.actionsContainer}>
      <button onClick={() => setOpen(!open)} style={styles.actionsToggle}>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
        </svg>
        <span>{actions.length} action{actions.length !== 1 ? 's' : ''} executed</span>
      </button>
      {open && (
        <div style={styles.actionsList}>
          {actions.map((a, i) => (
            <div key={i} style={styles.actionItem}>
              <span
                style={{
                  ...styles.actionDot,
                  background: a.success ? 'rgba(46,204,64,0.3)' : 'rgba(255,68,68,0.3)',
                  color: a.success ? '#2ecc40' : '#ff4444',
                }}
              >
                {a.success ? 'OK' : 'ERR'}
              </span>
              <span style={styles.actionName}>{a.tool}</span>
              <span style={styles.actionArgs}>
                {Object.entries(a.args)
                  .filter(([k]) => k !== 'values')
                  .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
                  .join(', ')
                  .substring(0, 80)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 10,
    padding: '40px 20px',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMsg: {
    alignSelf: 'flex-end',
    background: 'rgba(10,132,255,0.2)',
    border: '1px solid rgba(10,132,255,0.15)',
    borderRadius: '12px 12px 4px 12px',
    padding: '8px 12px',
    maxWidth: '85%',
    fontSize: 12,
    lineHeight: 1.45,
    wordBreak: 'break-word',
    userSelect: 'text',
    cursor: 'text',
  },
  assistantMsg: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px 12px 12px 4px',
    padding: '8px 12px',
    maxWidth: '92%',
    fontSize: 12,
    lineHeight: 1.45,
    wordBreak: 'break-word',
    userSelect: 'text',
    cursor: 'text',
  },
  msgContent: {
    whiteSpace: 'pre-wrap',
    userSelect: 'text',
  },
  thinking: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
  },
  actionsContainer: {
    marginTop: 6,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: 4,
  },
  actionsToggle: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 0',
  },
  actionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    marginTop: 4,
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    userSelect: 'text',
  },
  actionDot: {
    fontSize: 8,
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: 3,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  actionName: {
    fontWeight: 600,
    opacity: 0.7,
    flexShrink: 0,
  },
  actionArgs: {
    opacity: 0.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
