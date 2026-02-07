import React, { useState } from 'react'
import type { AppStatus } from '../../../main/shared/types'
import { AVAILABLE_MODELS } from '../App'

const api = window.sheetsOverlay

interface Props {
  status: AppStatus
  onRefresh: () => void
  onError: (msg: string) => void
  selectedModel: string
  onModelChange: (modelId: string) => void
  detectedSheetUrl: string | null
  onDismissDetected: () => void
}

export default function StatusBar({ status, onRefresh, onError, selectedModel, onModelChange, detectedSheetUrl, onDismissDetected }: Props) {
  const [showAttach, setShowAttach] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [hoverCollapse, setHoverCollapse] = useState(false)
  const [hoverClose, setHoverClose] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    try {
      const res = await api.signIn()
      if (!res.ok) onError(res.error ?? 'Sign-in failed')
      onRefresh()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await api.signOut()
      onRefresh()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAttach = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const res = await api.attachSheet(url.trim())
      if (!res.ok) {
        onError(res.error ?? 'Attach failed')
      } else {
        setShowAttach(false)
        setUrl('')
      }
      onRefresh()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDetected = async () => {
    if (!detectedSheetUrl) return
    setLoading(true)
    try {
      const res = await api.attachSheet(detectedSheetUrl)
      if (!res.ok) {
        onError(res.error ?? 'Attach failed')
      }
      onDismissDetected()
      onRefresh()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCollapse = () => {
    api.collapseOverlay()
  }

  const handleQuit = () => {
    api.quitApp()
  }

  const currentModelLabel = AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.label ?? 'Model'

  return (
    <div style={styles.container}>
      {/* Draggable header row */}
      <div style={styles.headerRow}>
        <div style={styles.headerLeft}>
          <button
            style={{
              ...styles.closeBtn,
              background: hoverClose ? '#ff5f57' : '#ff5f57aa',
              boxShadow: hoverClose ? '0 0 6px rgba(255,95,87,0.5)' : 'none',
            }}
            onMouseEnter={() => setHoverClose(true)}
            onMouseLeave={() => setHoverClose(false)}
            onClick={handleQuit}
            title="Quit app"
          >
            <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
          <div style={styles.dotGroup}>
            <span
              style={{
                ...styles.dot,
                background: status.signedIn ? '#1DB954' : '#555',
                boxShadow: status.signedIn ? '0 0 5px rgba(29,185,84,0.4)' : 'none',
              }}
              title={status.signedIn ? `Signed in as ${status.email ?? ''}` : 'Not signed in'}
            />
            <span
              style={{
                ...styles.dot,
                background: status.attached ? '#1DB954' : '#555',
                boxShadow: status.attached ? '0 0 5px rgba(29,185,84,0.4)' : 'none',
              }}
              title={status.attached ? 'Sheet attached' : 'No sheet'}
            />
          </div>
          {status.attached && status.spreadsheetTitle ? (
            <span style={styles.title}>{status.spreadsheetTitle}</span>
          ) : (
            <span style={styles.title}>
              <span style={styles.brandGreen}>tbl</span><span style={styles.brandWhite}>r.</span>
            </span>
          )}
        </div>
        <div style={styles.headerRight}>
          {status.attached && status.spreadsheetTitle && (
            <span style={styles.brandSmall}>
              <span style={styles.brandGreenSmall}>tbl</span><span style={styles.brandWhiteSmall}>r.</span>
            </span>
          )}
          <button
            style={{ ...styles.collapseBtn, opacity: hoverCollapse ? 0.9 : 0.45 }}
            onMouseEnter={() => setHoverCollapse(true)}
            onMouseLeave={() => setHoverCollapse(false)}
            onClick={handleCollapse}
            title="Collapse"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Action row */}
      <div style={styles.actionRow}>
        {!status.signedIn ? (
          <button onClick={handleSignIn} disabled={loading} style={styles.actionBtn}>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>
        ) : (
          <>
            <button onClick={() => { setShowAttach(!showAttach); setShowModelPicker(false) }} style={styles.actionBtn}>
              {status.attached ? 'Change Sheet' : 'Attach Sheet'}
            </button>
            <button
              onClick={() => { setShowModelPicker(!showModelPicker); setShowAttach(false) }}
              style={{
                ...styles.actionBtn,
                background: showModelPicker ? 'rgba(29,185,84,0.15)' : 'rgba(255,255,255,0.08)',
              }}
              title="Change AI model"
            >
              {currentModelLabel}
            </button>
            <button onClick={handleSignOut} disabled={loading} style={styles.actionBtnSecondary}>
              Sign out
            </button>
          </>
        )}
      </div>

      {/* Attach input */}
      {showAttach && (
        <div style={styles.attachRow}>
          <input
            style={styles.attachInput}
            placeholder="Paste Google Sheets URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAttach()}
            autoFocus
          />
          <button onClick={handleAttach} disabled={loading || !url.trim()} style={styles.attachGoBtn}>
            Go
          </button>
        </div>
      )}

      {/* Model picker */}
      {showModelPicker && (
        <div style={styles.modelPicker}>
          {AVAILABLE_MODELS.map((m) => (
            <button
              key={m.id}
              style={{
                ...styles.modelOption,
                background: selectedModel === m.id ? 'rgba(29,185,84,0.15)' : 'transparent',
                borderColor: selectedModel === m.id ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.06)',
              }}
              onClick={() => { onModelChange(m.id); setShowModelPicker(false) }}
            >
              <span style={styles.modelLabel}>{m.label}</span>
              <span style={styles.modelDesc}>{m.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Auto-detected sheet banner */}
      {detectedSheetUrl && !status.attached && (
        <div style={styles.detectedBanner}>
          <div style={styles.detectedContent}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, color: '#1DB954' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span style={styles.detectedText}>
              Sheet detected — attach it?
            </span>
          </div>
          <div style={styles.detectedActions}>
            <button
              onClick={handleConfirmDetected}
              disabled={loading}
              style={styles.detectedConfirmBtn}
            >
              {loading ? 'Attaching...' : 'Confirm'}
            </button>
            <button
              onClick={onDismissDetected}
              style={styles.detectedDismissBtn}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0,0,0,0.25)',
    borderBottom: '1px solid rgba(29,185,84,0.08)',
    flexShrink: 0,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px 4px',
    // @ts-ignore
    WebkitAppRegion: 'drag',
    minHeight: 36,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  closeBtn: {
    // @ts-ignore
    WebkitAppRegion: 'no-drag',
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: 'none',
    color: 'rgba(0,0,0,0.6)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  dotGroup: { display: 'flex', gap: 5 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
    transition: 'all 0.3s',
  },
  title: {
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
    opacity: 0.85,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
    display: 'flex',
    alignItems: 'baseline',
  },
  brandGreen: {
    fontFamily: 'Lexend, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: -0.5,
    color: '#1DB954',
  } as React.CSSProperties,
  brandWhite: {
    fontFamily: 'Lexend, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: -0.5,
    color: '#e0e0e0',
  } as React.CSSProperties,
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  brandSmall: {
    display: 'flex',
    alignItems: 'baseline',
    opacity: 0.5,
  },
  brandGreenSmall: {
    fontFamily: 'Lexend, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: -0.3,
    color: '#1DB954',
  } as React.CSSProperties,
  brandWhiteSmall: {
    fontFamily: 'Lexend, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: -0.3,
    color: '#e0e0e0',
  } as React.CSSProperties,
  collapseBtn: {
    // @ts-ignore
    WebkitAppRegion: 'no-drag',
    background: 'none',
    border: 'none',
    color: '#e0e0e0',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
  actionRow: {
    display: 'flex',
    gap: 5,
    padding: '4px 14px 8px',
    // @ts-ignore
    WebkitAppRegion: 'no-drag',
  },
  actionBtn: {
    flex: 1,
    padding: '5px 8px',
    borderRadius: 6,
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  actionBtnSecondary: {
    padding: '5px 8px',
    borderRadius: 6,
    border: 'none',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  attachRow: {
    display: 'flex',
    gap: 6,
    padding: '0 14px 8px',
  },
  attachInput: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid rgba(29,185,84,0.2)',
    background: 'rgba(0,0,0,0.3)',
    color: '#e0e0e0',
    fontSize: 11,
    outline: 'none',
  },
  attachGoBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: 'rgba(29,185,84,0.8)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  modelPicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: '0 14px 8px',
    maxHeight: 220,
    overflowY: 'auto',
  },
  modelOption: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  modelLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
  },
  modelDesc: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
  },
  detectedBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px 8px',
    background: 'rgba(29, 185, 84, 0.08)',
    borderTop: '1px solid rgba(29, 185, 84, 0.15)',
  },
  detectedContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  detectedText: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  detectedActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  detectedConfirmBtn: {
    padding: '4px 12px',
    borderRadius: 6,
    border: 'none',
    background: 'rgba(29, 185, 84, 0.75)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  detectedDismissBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
  },
}
