import React, { useState } from 'react'
import type { AppStatus } from '../../../main/shared/types'

type Tab = 'main' | 'logs' | 'budget'

interface Props {
  status: AppStatus
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  children: React.ReactNode
}

const api = window.sheetsOverlay

export default function OverlayShell({ status, activeTab, onTabChange, children }: Props) {
  const [hoverClose, setHoverClose] = useState(false)

  const handleCollapse = () => {
    api.collapseOverlay()
  }

  return (
    <div style={styles.shell}>
      {/* Header / drag handle */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.dotGroup}>
            <span
              style={{
                ...styles.dot,
                background: status.signedIn ? '#2ecc40' : '#555',
                boxShadow: status.signedIn ? '0 0 6px rgba(46,204,64,0.4)' : 'none',
              }}
              title={status.signedIn ? `Signed in as ${status.email ?? ''}` : 'Not signed in'}
            />
            <span
              style={{
                ...styles.dot,
                background: status.attached ? '#0a84ff' : '#555',
                boxShadow: status.attached ? '0 0 6px rgba(10,132,255,0.4)' : 'none',
              }}
              title={status.attached ? `Sheet attached` : 'No sheet attached'}
            />
          </div>
          <span style={styles.title}>Sheets Overlay</span>
        </div>
        <button
          style={{
            ...styles.collapseBtn,
            opacity: hoverClose ? 0.9 : 0.45,
          }}
          onMouseEnter={() => setHoverClose(true)}
          onMouseLeave={() => setHoverClose(false)}
          onClick={handleCollapse}
          title="Collapse (Cmd+Shift+Space)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {(['main', 'logs', 'budget'] as Tab[]).map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
            onClick={() => onTabChange(tab)}
          >
            {tab === 'main' && 'Home'}
            {tab === 'logs' && 'Logs'}
            {tab === 'budget' && 'Budget'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.body}>{children}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    color: '#e0e0e0',
    background: 'rgba(24, 24, 26, 0.78)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    userSelect: 'none',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    // @ts-ignore — Electron drag region
    WebkitAppRegion: 'drag',
    background: 'rgba(0,0,0,0.2)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    minHeight: 40,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  dotGroup: {
    display: 'flex',
    gap: 5,
  },
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
  },
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
  tabBar: {
    display: 'flex',
    gap: 2,
    padding: '6px 12px',
    background: 'rgba(0,0,0,0.1)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  tab: {
    flex: 1,
    padding: '5px 0',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: 0.3,
  },
  tabActive: {
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.85)',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
}
