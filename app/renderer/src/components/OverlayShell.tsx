import React from 'react'
import type { AppStatus } from '../../../main/shared/types'

interface Props {
  status: AppStatus
  children: React.ReactNode
}

export default function OverlayShell({ status, children }: Props) {
  const authBadge = status.signedIn ? 'Signed in' : 'Not signed in'
  const attachBadge = status.attached ? 'Attached' : 'Not attached'

  return (
    <div style={styles.shell}>
      {/* Drag handle */}
      <div style={styles.header}>
        <span style={styles.title}>Sheets Overlay</span>
        <span style={styles.badges}>
          <span style={{ ...styles.badge, background: status.signedIn ? '#2ecc40' : '#888' }}>
            {authBadge}
          </span>
          <span style={{ ...styles.badge, background: status.attached ? '#0074d9' : '#888' }}>
            {attachBadge}
          </span>
        </span>
      </div>
      <div style={styles.body}>{children}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    color: '#e0e0e0',
    background: 'rgba(28, 28, 30, 0.88)',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    userSelect: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    // @ts-ignore — Electron-specific
    WebkitAppRegion: 'drag',
    background: 'rgba(0,0,0,0.35)',
  },
  title: {
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  badges: {
    display: 'flex',
    gap: 6,
  },
  badge: {
    fontSize: 10,
    padding: '2px 7px',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 600,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
}
