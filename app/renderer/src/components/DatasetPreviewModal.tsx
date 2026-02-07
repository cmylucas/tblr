import React from 'react'
import type { DatasetMeta } from '../../../main/datasets/datasetTypes'
import type { CsvPreview } from '../../../main/attachments/types'

interface Props {
  dataset: DatasetMeta
  preview: CsvPreview
  onClose: () => void
}

export default function DatasetPreviewModal({ dataset, preview, onClose }: Props) {
  const sourceLabel =
    dataset.source.type === 'sec-filing'
      ? `SEC Filing: ${dataset.source.secFiling?.ticker || dataset.source.secFiling?.cik}`
      : `Uploaded: ${dataset.source.original?.filename}`

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{dataset.name}</h3>
          <button onClick={onClose} style={styles.closeBtn}>
            ×
          </button>
        </div>

        <div style={styles.meta}>
          <span>{sourceLabel}</span>
          <span>•</span>
          <span>{preview.rowCount.toLocaleString()} rows</span>
          <span>•</span>
          <span>{preview.colCount} columns</span>
        </div>

        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                {preview.headers.map((h, i) => (
                  <th key={i} style={styles.th}>
                    {h || `Column ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={styles.td}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.footer}>
          Showing first {preview.sampleRows.length} of {preview.rowCount.toLocaleString()} rows
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 24,
    maxWidth: 900,
    width: '90%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 28,
    color: '#a0a0a0',
    cursor: 'pointer',
    padding: 0,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    transition: 'all 0.15s',
  },
  meta: {
    display: 'flex',
    gap: 8,
    fontSize: 13,
    color: '#a0a0a0',
    marginBottom: 16,
  },
  tableContainer: {
    flex: 1,
    overflow: 'auto',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    marginBottom: 12,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    padding: '8px 12px',
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    fontWeight: 600,
    color: '#e0e0e0',
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '6px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    color: '#c0c0c0',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  footer: {
    fontSize: 12,
    color: '#808080',
    textAlign: 'center',
  },
}
