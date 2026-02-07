import React, { useState } from 'react'
import type { CsvPreview } from '../../../main/attachments/types'

interface Props {
  fileName: string
  preview: CsvPreview
  onAttachToLlm: () => void
  onImportToSheets: (sheetName: string) => void
  onCancel: () => void
  importing: boolean
}

export default function ImportCsvModal({ fileName, preview, onAttachToLlm, onImportToSheets, onCancel, importing }: Props) {
  const baseName = fileName.replace(/\.(csv|tsv)$/i, '')
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const [sheetName, setSheetName] = useState(`Import_${baseName}_${dateStr}`)

  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
          </svg>
          <span style={styles.fileName}>{fileName}</span>
        </div>

        {/* Stats */}
        <div style={styles.stats}>
          <span>{preview.rowCount.toLocaleString()} rows</span>
          <span style={styles.statDot} />
          <span>{preview.colCount} columns</span>
          <span style={styles.statDot} />
          <span>delimiter: {preview.delimiter}</span>
        </div>

        {/* Preview table */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {preview.headers.map((h, i) => (
                  <th key={i} style={styles.th}>{h || `col${i + 1}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.slice(0, 5).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={styles.td}>{cell.length > 30 ? cell.slice(0, 30) + '...' : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {preview.rowCount > 5 && (
            <div style={styles.moreRows}>...and {(preview.rowCount - 5).toLocaleString()} more rows</div>
          )}
        </div>

        {/* Sheet name input (for import) */}
        <div style={styles.sheetNameRow}>
          <label style={styles.label}>Sheet name:</label>
          <input
            style={styles.input}
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            placeholder="New sheet name..."
          />
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            style={styles.primaryBtn}
            onClick={onAttachToLlm}
            disabled={importing}
          >
            Attach to LLM
          </button>
          <button
            style={styles.importBtn}
            onClick={() => onImportToSheets(sheetName)}
            disabled={importing || !sheetName.trim()}
          >
            {importing ? 'Importing...' : 'Import to Sheets'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'rgba(30, 30, 34, 0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    width: 340,
    maxHeight: '80vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    fontSize: 13,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
  },
  tableWrap: {
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    overflow: 'auto',
    maxHeight: 180,
    background: 'rgba(0,0,0,0.2)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 10,
  },
  th: {
    padding: '5px 8px',
    textAlign: 'left',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '4px 8px',
    color: 'rgba(255,255,255,0.5)',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    whiteSpace: 'nowrap',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  moreRows: {
    padding: '4px 8px',
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
  sheetNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 0,
    fontWeight: 600,
  },
  input: {
    flex: 1,
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.3)',
    color: '#e0e0e0',
    fontSize: 11,
    outline: 'none',
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  primaryBtn: {
    flex: 1,
    padding: '7px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'rgba(29,185,84,0.8)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  importBtn: {
    flex: 1,
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
