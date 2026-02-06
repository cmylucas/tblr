import React, { useEffect, useState, useCallback } from 'react'
import type { AppStatus, AuditEntry, AnalysisResult } from '../../main/shared/types'
import OverlayShell from './components/OverlayShell'
import AuthPanel from './components/AuthPanel'
import AttachSheet from './components/AttachSheet'
import ReadRange from './components/ReadRange'
import WriteRange from './components/WriteRange'
import AuditLog from './components/AuditLog'
import FinancialDataConfig from './components/FinancialDataConfig'
import BudgetInsights from './components/BudgetInsights'

const api = window.sheetsOverlay

export default function App() {
  const [status, setStatus] = useState<AppStatus>({
    signedIn: false,
    attached: false,
  })
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  // AI analysis state
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analyzingData, setAnalyzingData] = useState(false)

  const refreshStatus = useCallback(async () => {
    const res = await api.getStatus()
    if (res.ok && res.data) setStatus(res.data)
  }, [])

  const refreshAuditLog = useCallback(async () => {
    const res = await api.getAuditLog()
    if (res.ok && res.data) setAuditLog(res.data)
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([refreshStatus(), refreshAuditLog()])
  }, [refreshStatus, refreshAuditLog])

  const handleAnalyze = useCallback(async (range: string, mapping: any) => {
    try {
      setAnalyzingData(true)
      setError(null)

      const result = await api.analyzeFinancialData(range, mapping)

      if (!result.ok) {
        setError(result.error || 'Analysis failed')
        return
      }

      setAnalysis(result.data || null)
      await refresh() // Update audit log
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setAnalyzingData(false)
    }
  }, [refresh])

  const handleRefreshAnalysis = useCallback(async () => {
    const result = await api.getInsights()
    if (result.ok && result.data) {
      setAnalysis(result.data)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <OverlayShell status={status}>
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError(null)} style={styles.dismissBtn}>
            x
          </button>
        </div>
      )}
      <AuthPanel status={status} onAction={refresh} onError={setError} />
      <AttachSheet status={status} onAction={refresh} onError={setError} />
      {status.signedIn && status.attached && (
        <>
          <FinancialDataConfig onAnalyze={handleAnalyze} onError={setError} />
          <BudgetInsights analysis={analysis} loading={analyzingData} onRefresh={handleRefreshAnalysis} />
          <ReadRange onAction={refresh} onError={setError} />
          <WriteRange onAction={refresh} onError={setError} />
        </>
      )}
      <AuditLog entries={auditLog} />
    </OverlayShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  error: {
    background: '#ff4444',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '0 0 8px',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 14,
  },
}
