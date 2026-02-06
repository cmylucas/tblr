import { useState } from 'react'
import { sectionStyle, labelStyle, inputStyle, btnStyle } from './styles'

interface Props {
  onAnalyze: (range: string, mapping: ColumnMapping) => Promise<void>
  onError: (msg: string) => void
}

interface ColumnMapping {
  dateColumn: number
  amountColumn: number
  categoryColumn?: number
  descriptionColumn?: number
}

interface PreviewTransaction {
  date: string
  amount: string
  category: string
  description: string
}

export default function FinancialDataConfig({ onAnalyze, onError }: Props) {
  const [range, setRange] = useState('Sheet1!A2:D100')
  const [dateColumn, setDateColumn] = useState(0)
  const [amountColumn, setAmountColumn] = useState(2)
  const [categoryColumn, setCategoryColumn] = useState(1)
  const [descriptionColumn, setDescriptionColumn] = useState(3)
  const [preview, setPreview] = useState<PreviewTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const handlePreview = async () => {
    try {
      setLoading(true)
      setPreview([])

      // Read range from sheet
      const result = await window.sheetsOverlay.readRange(range)
      if (!result.ok) {
        onError(result.error || 'Failed to read range')
        return
      }

      const data = result.data || []
      if (data.length === 0) {
        onError('No data found in range')
        return
      }

      // Preview first 5 rows (skip header)
      const previewData = data.slice(1, 6).map((row) => ({
        date: row[dateColumn] || 'N/A',
        amount: row[amountColumn] || 'N/A',
        category: categoryColumn !== undefined ? row[categoryColumn] || 'Uncategorized' : 'Uncategorized',
        description: descriptionColumn !== undefined ? row[descriptionColumn] || '' : '',
      }))

      setPreview(previewData)
    } catch (err: any) {
      onError(err.message || 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true)

      const mapping: ColumnMapping = {
        dateColumn,
        amountColumn,
        categoryColumn: categoryColumn !== undefined ? categoryColumn : undefined,
        descriptionColumn: descriptionColumn !== undefined ? descriptionColumn : undefined,
      }

      await onAnalyze(range, mapping)
    } catch (err: any) {
      onError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={labelStyle}>AI BUDGET INTELLIGENCE</div>

      {/* Range input */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 4 }}>
          Data Range
        </label>
        <input
          type="text"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          placeholder="e.g., Sheet1!A2:E100"
          style={inputStyle}
        />
      </div>

      {/* Column mapping */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div>
          <label style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 4 }}>
            Date Column *
          </label>
          <select value={dateColumn} onChange={(e) => setDateColumn(Number(e.target.value))} style={inputStyle}>
            <option value={0}>A (1st)</option>
            <option value={1}>B (2nd)</option>
            <option value={2}>C (3rd)</option>
            <option value={3}>D (4th)</option>
            <option value={4}>E (5th)</option>
            <option value={5}>F (6th)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 4 }}>
            Amount Column *
          </label>
          <select value={amountColumn} onChange={(e) => setAmountColumn(Number(e.target.value))} style={inputStyle}>
            <option value={0}>A (1st)</option>
            <option value={1}>B (2nd)</option>
            <option value={2}>C (3rd)</option>
            <option value={3}>D (4th)</option>
            <option value={4}>E (5th)</option>
            <option value={5}>F (6th)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 4 }}>
            Category Column
          </label>
          <select
            value={categoryColumn !== undefined ? categoryColumn : -1}
            onChange={(e) => {
              const val = Number(e.target.value)
              setCategoryColumn(val === -1 ? undefined : val)
            }}
            style={inputStyle}
          >
            <option value={-1}>None</option>
            <option value={0}>A (1st)</option>
            <option value={1}>B (2nd)</option>
            <option value={2}>C (3rd)</option>
            <option value={3}>D (4th)</option>
            <option value={4}>E (5th)</option>
            <option value={5}>F (6th)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 4 }}>
            Description Column
          </label>
          <select
            value={descriptionColumn !== undefined ? descriptionColumn : -1}
            onChange={(e) => {
              const val = Number(e.target.value)
              setDescriptionColumn(val === -1 ? undefined : val)
            }}
            style={inputStyle}
          >
            <option value={-1}>None</option>
            <option value={0}>A (1st)</option>
            <option value={1}>B (2nd)</option>
            <option value={2}>C (3rd)</option>
            <option value={3}>D (4th)</option>
            <option value={4}>E (5th)</option>
            <option value={5}>F (6th)</option>
          </select>
        </div>
      </div>

      {/* Preview button */}
      <button onClick={handlePreview} disabled={loading} style={{ ...btnStyle, width: '100%', marginBottom: 8 }}>
        {loading ? 'Loading...' : 'Preview Data'}
      </button>

      {/* Preview table */}
      {preview.length > 0 && (
        <div style={{ marginBottom: 8, maxHeight: 150, overflow: 'auto' }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Preview (first 5 rows):</div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Date</th>
                <th style={{ textAlign: 'right', padding: '4px 6px' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: '4px 6px' }}>{t.date}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>${t.amount}</td>
                  <td style={{ padding: '4px 6px' }}>{t.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing || preview.length === 0}
        style={{
          ...btnStyle,
          width: '100%',
          background: preview.length === 0 ? 'rgba(10,132,255,0.3)' : '#0a84ff',
          cursor: preview.length === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        {analyzing ? 'Analyzing...' : 'Analyze with AI 🤖'}
      </button>

      {preview.length === 0 && (
        <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, textAlign: 'center' }}>
          Preview data first to enable analysis
        </div>
      )}
    </div>
  )
}
