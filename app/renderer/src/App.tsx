import React, { useEffect, useState, useCallback } from 'react'
import type { AppStatus, ChatMessage } from '../../main/shared/types'
import StatusBar from './components/StatusBar'
import MessageList, { type DisplayMessage } from './components/MessageList'
import MessageInput from './components/MessageInput'
import AuditLog from './components/AuditLog'

const api = window.sheetsOverlay

let msgIdCounter = 0
function nextId(): string {
  return `msg-${++msgIdCounter}-${Date.now()}`
}

export type ModelTier = 'smart' | 'balanced' | 'fast'
type Tab = 'chat' | 'logs'

export default function App() {
  const [status, setStatus] = useState<AppStatus>({
    signedIn: false,
    attached: false,
  })
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string>('thinking')
  const [error, setError] = useState<string | null>(null)
  const [modelTier, setModelTier] = useState<ModelTier>('smart')
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  const refreshStatus = useCallback(async () => {
    const res = await api.getStatus()
    if (res.ok && res.data) setStatus(res.data)
  }, [])

  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, 5000)
    return () => clearInterval(id)
  }, [refreshStatus])

  // Listen for chat progress events from main process
  useEffect(() => {
    const cleanup = api.onChatProgress((status) => {
      setLoadingStatus(status)
    })
    return cleanup
  }, [])

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: DisplayMessage = {
        id: nextId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)
      setLoadingStatus('thinking')
      setError(null)

      try {
        const res = await api.sendChat(chatHistory, text, modelTier)

        if (!res.ok) {
          setError(res.error ?? 'Chat failed')
          setLoading(false)
          return
        }

        const data = res.data!
        const assistantMsg: DisplayMessage = {
          id: nextId(),
          role: 'assistant',
          content: data.message,
          actions: data.actions,
          timestamp: Date.now(),
        }

        setMessages((prev) => [...prev, assistantMsg])

        setChatHistory((prev) => [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: data.message },
        ])

        refreshStatus()
      } catch (err: any) {
        setError(err.message ?? 'Chat failed')
      } finally {
        setLoading(false)
      }
    },
    [chatHistory, refreshStatus, modelTier]
  )

  return (
    <div style={styles.shell}>
      <StatusBar
        status={status}
        onRefresh={refreshStatus}
        onError={setError}
        modelTier={modelTier}
        onModelChange={setModelTier}
      />

      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'chat' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('chat')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
          Chat
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'logs' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('logs')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z" />
          </svg>
          Logs
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          <span style={styles.errorText}>{error}</span>
          <button onClick={() => setError(null)} style={styles.dismissBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      )}

      {activeTab === 'chat' ? (
        <>
          <div style={styles.messagesArea}>
            <MessageList messages={messages} loading={loading} loadingStatus={loadingStatus} />
          </div>
          <MessageInput onSend={handleSend} disabled={loading} />
        </>
      ) : (
        <div style={styles.messagesArea}>
          <AuditLog />
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    color: '#e0e0e0',
    background: 'rgba(20, 20, 22, 0.88)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  tabBar: {
    display: 'flex',
    gap: 2,
    padding: '0 12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    flexShrink: 0,
    background: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    padding: '7px 0',
    border: 'none',
    background: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: 'rgba(255,255,255,0.85)',
    borderBottom: '2px solid rgba(10,132,255,0.7)',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  error: {
    background: 'rgba(255,68,68,0.15)',
    border: '1px solid rgba(255,68,68,0.3)',
    color: '#ff6b6b',
    padding: '6px 10px',
    margin: '0 12px',
    borderRadius: 8,
    fontSize: 11,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  errorText: { flex: 1, lineHeight: 1.3 },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#ff6b6b',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
}
