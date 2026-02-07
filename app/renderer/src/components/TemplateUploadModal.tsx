import React, { useState } from 'react'

const api = window.sheetsOverlay

interface Props {
  onSubmit: (templateName: string, category: string) => Promise<void>
  onCancel: () => void
}

export default function TemplateUploadModal({ onSubmit, onCancel }: Props) {
  const [templateName, setTemplateName] = useState('')
  const [category, setCategory] = useState<'dcf' | 'lbo' | 'comps' | 'merger' | 'other'>('dcf')
  const [uploading, setUploading] = useState(false)

  const handleSubmit = async () => {
    if (!templateName.trim()) return
    setUploading(true)
    try {
      await onSubmit(templateName.trim(), category)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Upload Template</h3>
          <button onClick={onCancel} style={styles.closeBtn}>
            ×
          </button>
        </div>

        <div style={styles.content}>
          <div style={styles.hint}>
            You'll be prompted to select an XLSX file after clicking Upload.
          </div>

          {/* Template Name */}
          <div style={styles.field}>
            <label style={styles.label}>Template Name:</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., DCF - Tech Company"
              style={styles.input}
              autoFocus
            />
          </div>

          {/* Category Selection */}
          <div style={styles.field}>
            <label style={styles.label}>Category:</label>
            <div style={styles.categoryGrid}>
              {(['dcf', 'lbo', 'comps', 'merger', 'other'] as const).map((cat) => {
                const icons = { dcf: '📊', lbo: '💰', comps: '📈', merger: '🤝', other: '📋' }
                const isSelected = category === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    style={{
                      ...styles.categoryBtn,
                      ...(isSelected ? styles.categoryBtnSelected : {}),
                    }}
                  >
                    <span style={styles.categoryIcon}>{icons[cat]}</span>
                    <span style={styles.categoryLabel}>{cat.toUpperCase()}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button onClick={onCancel} style={styles.cancelBtn}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!templateName.trim() || uploading}
              style={{
                ...styles.submitBtn,
                ...((!templateName.trim() || uploading) ? styles.submitBtnDisabled : {}),
              }}
            >
              {uploading ? 'Uploading...' : 'Upload Template'}
            </button>
          </div>
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
    backgroundColor: 'rgba(30,30,32,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    width: '90%',
    maxWidth: 500,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#e0e0e0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    color: '#a0a0a0',
    cursor: 'pointer',
    padding: 0,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#b0b0b0',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#808080',
    marginBottom: 16,
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e0e0e0',
    outline: 'none',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  categoryBtn: {
    padding: '12px 8px',
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#a0a0a0',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  categoryBtnSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
    color: '#a78bfa',
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 11,
  },
  actions: {
    display: 'flex',
    gap: 10,
    marginTop: 20,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    color: '#a0a0a0',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: '#1DB954',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  submitBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}
