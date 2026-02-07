import React from 'react'
import type { TemplateMeta } from '../../../main/templates/templateTypes'

interface Props {
  template: TemplateMeta
  onUse: () => void
  onView: () => void
  onDelete: () => void
}

export default function TemplateListItem({ template, onUse, onView, onDelete }: Props) {
  const handleDelete = () => {
    if (confirm(`Delete template "${template.name}"?`)) {
      onDelete()
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.info}>
          <div style={styles.name}>{template.name}</div>
          <div style={styles.meta}>
            {template.category.toUpperCase()} • {template.requiredInputs.length} required inputs •{' '}
            {template.outputRanges.length} outputs
            {template.lastUsed && (
              <>
                {' '}
                • <span style={styles.lastUsed}>Last used: {new Date(template.lastUsed).toLocaleDateString()}</span>
              </>
            )}
          </div>
          {template.description && <div style={styles.description}>{template.description}</div>}
        </div>
      </div>

      <div style={styles.actions}>
        <button onClick={onUse} style={{ ...styles.actionBtn, ...styles.useBtn }}>
          Use Template
        </button>
        <button onClick={onView} style={styles.actionBtn}>
          View in Drive
        </button>
        <button onClick={handleDelete} style={{ ...styles.actionBtn, ...styles.deleteBtn }}>
          Delete
        </button>
      </div>
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
    marginBottom: 4,
  },
  lastUsed: {
    color: '#8080ff',
  },
  description: {
    fontSize: 12,
    color: '#b0b0b0',
    marginTop: 6,
    fontStyle: 'italic',
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
  useBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
    color: '#a78bfa',
  },
  deleteBtn: {
    borderColor: 'rgba(255,100,100,0.3)',
    color: '#ff6464',
  },
}
