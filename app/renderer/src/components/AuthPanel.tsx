import React, { useState } from 'react'
import type { AppStatus } from '../../../main/shared/types'
import { sectionStyle, btnStyle, btnPrimaryStyle, labelStyle } from './styles'

const api = window.sheetsOverlay

interface Props {
  status: AppStatus
  onAction: () => void
  onError: (msg: string) => void
}

export default function AuthPanel({ status, onAction, onError }: Props) {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    try {
      const res = await api.signIn()
      if (!res.ok) onError(res.error ?? 'Sign-in failed')
      onAction()
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
      onAction()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={labelStyle}>Account</div>
      {status.signedIn ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, opacity: 0.7, flex: 1 }}>{status.email ?? 'Signed in'}</span>
          <button onClick={handleSignOut} disabled={loading} style={btnStyle}>
            Sign out
          </button>
        </div>
      ) : (
        <button onClick={handleSignIn} disabled={loading} style={{ ...btnPrimaryStyle, width: '100%' }}>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      )}
    </div>
  )
}
