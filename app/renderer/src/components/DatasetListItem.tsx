import React, { useState } from 'react'
import type { DatasetMeta } from '../../../main/datasets/datasetTypes'

interface Props {
  dataset: DatasetMeta
  isAttached: boolean
  onAttach: () => void
  onDetach: () => void
  onPreview: () => void
  onImport: (sheetName: string) => void
  onDelete: () => void
  onBuildDb: () => void
}

export default function DatasetListItem({
  dataset,
  isAttached,
  onAttach,
  onDetach,
  onPreview,
  onImport,
  onDelete,
  onBuildDb,
}: Props) {
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [sheetName, setSheetName] = useState('')
  const [buildingDb, setBuildingDb] = useState(false)

  const sourceLabel =
    dataset.source.type === 'sec-filing'
      ? `SEC: ${dataset.source.secFiling?.ticker || `CIK ${dataset.source.secFiling?.cik}`}`
      : 'Upload'

  const icon = dataset.source.type === 'sec-filing' ? '🏛️' : '📄'

  const handleImport = async () => {
    const finalName = sheetName.trim() || defaultSheetName
    setShowImportDialog(false)
    await onImport(finalName)
    setSheetName('')
  }

  const handleDelete = () => {
    if (confirm(`Delete dataset "${dataset.name}"?`)) {
      onDelete()
    }
  }

  const handleBuildDb = async () => {
    if (confirm(`Build database for "${dataset.name}"? This will enable token-efficient queries.`)) {
      setBuildingDb(true)
      try {
        await onBuildDb()
      } finally {
        setBuildingDb(false)
      }
    }
  }

  // Generate default sheet name
  const defaultSheetName = `Import_${dataset.name}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

  // Show "Build DB" button if dataset is large and doesn't have DB
  const canBuildDb = !dataset.dbInfo && dataset.stats.rowCount > 1000

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.icon}>{icon}</div>
        <div style={styles.info}>
          <div style={styles.name}>{dataset.name}</div>
          <div style={styles.meta}>
            {sourceLabel} • {dataset.stats.rowCount.toLocaleString()} rows • {dataset.stats.colCount} cols
            {dataset.dbInfo && (
              <>
                {' '}• <span style={styles.dbBadge}>DB-backed</span>
                {dataset.dbInfo.summaryCreated && (
                  <> • <span style={styles.summaryBadge}>Finance Summary</span></>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        <button onClick={onPreview} style={styles.actionBtn}>
          Preview
        </button>
        {isAttached ? (
          <button onClick={onDetach} style={{ ...styles.actionBtn, ...styles.attachedBtn }}>
            ✓ Attached
          </button>
        ) : (
          <button onClick={onAttach} style={styles.actionBtn}>
            Attach to Chat
          </button>
        )}
        {canBuildDb && (
          <button onClick={handleBuildDb} disabled={buildingDb} style={{ ...styles.actionBtn, ...styles.buildDbBtn }}>
            {buildingDb ? 'Building...' : 'Build DB'}
          </button>
        )}
        <button onClick={() => setShowImportDialog(true)} style={styles.actionBtn}>
          Import to Sheets
        </button>
        <button onClick={handleDelete} style={{ ...styles.actionBtn, ...styles.deleteBtn }}>
          Delete
        </button>
      </div>

      {showImportDialog && (
        <div style={styles.importDialog}>
          <div style={styles.dialogContent}>
            <label style={styles.label}>Sheet name:</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder={defaultSheetName}
              style={styles.input}
              autoFocus
            />
            <div style={styles.dialogActions}>
              <button onClick={() => setShowImportDialog(false)} style={styles.cancelBtn}>
                Cancel
              </button>
              <button onClick={handleImport} style={styles.submitBtn}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  dbBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: '#60a5fa',
    letterSpacing: 0.3,
  },
  summaryBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    color: '#a78bfa',
    letterSpacing: 0.3,
  },
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    color: '#a0a0a0',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  attachedBtn: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderColor: '#1DB954',
    color: '#1DB954',
  },
  buildDbBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
    color: '#60a5fa',
  },
  deleteBtn: {
    borderColor: 'rgba(255,100,100,0.3)',
    color: '#ff6464',
  },
  importDialog: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: '#b0b0b0',
  },
  input: {
    padding: '8px 10px',
    fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    color: '#e0e0e0',
    outline: 'none',
  },
  dialogActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4,
    color: '#a0a0a0',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: '#1DB954',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
  },
}
