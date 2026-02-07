import React, { useState, useEffect } from 'react'
import type { DatasetMeta } from '../../../main/datasets/datasetTypes'
import type { TemplateMeta } from '../../../main/templates/templateTypes'
import type { CsvPreview } from '../../../main/attachments/types'
import DatasetListItem from './DatasetListItem'
import TemplateListItem from './TemplateListItem'
import DatasetPreviewModal from './DatasetPreviewModal'
import TickerInputModal from './TickerInputModal'

const api = window.sheetsOverlay

interface Props {
  datasets: DatasetMeta[]
  attachedDatasetIds: string[]
  onRefresh: () => void
  onAttach: (datasetId: string) => void
  onDetach: (datasetId: string) => void
}

export default function FilesTabWithTemplates({
  datasets,
  attachedDatasetIds,
  onRefresh,
  onAttach,
  onDetach,
}: Props) {
  const [activeTab, setActiveTab] = useState<'datasets' | 'templates'>('datasets')
  const [templates, setTemplates] = useState<TemplateMeta[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewDataset, setPreviewDataset] = useState<{ meta: DatasetMeta; preview: CsvPreview } | null>(null)
  const [tickerPrompt, setTickerPrompt] = useState<{ pdfPath: string; filename: string } | null>(null)

  // Load templates on mount and when tab switches
  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates()
    }
  }, [activeTab])

  const loadTemplates = async () => {
    try {
      const res = await api.listTemplates()
      if (res.ok && res.data) {
        setTemplates(res.data as TemplateMeta[])
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  // Dataset handlers
  const handleDatasetUpload = async () => {
    setUploading(true)
    setError(null)

    try {
      const res = await api.openDatasetUploadDialog()

      if (!res.ok) {
        if (res.error === 'CIK_NOT_FOUND') {
          setTickerPrompt((res.data as any) || null)
        } else if (res.error !== 'No file selected') {
          setError(res.error || 'Failed to upload dataset')
        }
        return
      }

      await onRefresh()
    } catch (err: any) {
      setError(err.message || 'Failed to upload dataset')
    } finally {
      setUploading(false)
    }
  }

  const handleTickerSubmit = async (ticker: string) => {
    if (!tickerPrompt) return

    setUploading(true)
    setError(null)

    try {
      const res = await api.submitTickerForDataset(tickerPrompt.pdfPath, tickerPrompt.filename, ticker)

      if (!res.ok) {
        setError(res.error || 'Failed to process PDF')
        return
      }

      setTickerPrompt(null)
      await onRefresh()
    } catch (err: any) {
      setError(err.message || 'Failed to process PDF')
    } finally {
      setUploading(false)
    }
  }

  const handlePreview = async (dataset: DatasetMeta) => {
    try {
      const res = await api.getDatasetPreview(dataset.datasetId)
      if (res.ok && res.data) {
        setPreviewDataset({ meta: dataset, preview: res.data as CsvPreview })
      } else {
        setError(res.error || 'Failed to preview dataset')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to preview dataset')
    }
  }

  const handleImport = async (dataset: DatasetMeta, sheetName: string) => {
    try {
      const res = await api.importDatasetToSheet(dataset.datasetId, sheetName)
      if (!res.ok) {
        setError(res.error || 'Failed to import dataset')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import dataset')
    }
  }

  const handleDatasetDelete = async (dataset: DatasetMeta) => {
    try {
      const res = await api.deleteDataset(dataset.datasetId)
      if (res.ok) {
        await onRefresh()
      } else {
        setError(res.error || 'Failed to delete dataset')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete dataset')
    }
  }

  const handleBuildDb = async (dataset: DatasetMeta) => {
    try {
      const res = await api.buildDatasetDb(dataset.datasetId)
      if (res.ok) {
        await onRefresh()
      } else {
        setError(res.error || 'Failed to build database')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to build database')
    }
  }

  // Template handlers
  const handleTemplateUpload = async () => {
    setUploading(true)
    setError(null)

    try {
      // Open file dialog (using Electron dialog)
      const { dialog } = require('@electron/remote')
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
      })

      if (result.canceled || result.filePaths.length === 0) {
        setUploading(false)
        return
      }

      const xlsxPath = result.filePaths[0]
      const filename = xlsxPath.split('/').pop() || 'Template'
      const templateName = filename.replace('.xlsx', '')

      const res = await api.uploadTemplate(xlsxPath, templateName, 'dcf')

      if (!res.ok) {
        setError(res.error || 'Failed to upload template')
        return
      }

      await loadTemplates()
    } catch (err: any) {
      setError(err.message || 'Failed to upload template')
    } finally {
      setUploading(false)
    }
  }

  const handleTemplateUse = (template: TemplateMeta) => {
    setError(`Template "${template.name}" selected. Ask the LLM to create a model from this template in the Chat tab.`)
  }

  const handleTemplateView = (template: TemplateMeta) => {
    window.open(template.driveWebViewLink, '_blank')
  }

  const handleTemplateDelete = async (template: TemplateMeta) => {
    try {
      const res = await api.deleteTemplate(template.templateId)
      if (res.ok) {
        await loadTemplates()
      } else {
        setError(res.error || 'Failed to delete template')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete template')
    }
  }

  return (
    <div style={styles.container}>
      {/* Tab Header */}
      <div style={styles.tabHeader}>
        <button
          onClick={() => setActiveTab('datasets')}
          style={{
            ...styles.tab,
            ...(activeTab === 'datasets' ? styles.activeTab : {}),
          }}
        >
          Datasets ({datasets.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            ...styles.tab,
            ...(activeTab === 'templates' ? styles.activeTab : {}),
          }}
        >
          Templates ({templates.length})
        </button>
      </div>

      {/* Content Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>{activeTab === 'datasets' ? 'Datasets' : 'Templates'}</h2>
        <button
          onClick={activeTab === 'datasets' ? handleDatasetUpload : handleTemplateUpload}
          disabled={uploading}
          style={styles.uploadBtn}
        >
          {uploading
            ? 'Uploading...'
            : activeTab === 'datasets'
              ? '+ Upload Dataset'
              : '+ Upload Template'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={styles.error}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={styles.errorClose}>
            ×
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === 'datasets' ? (
        datasets.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📊</div>
            <div style={styles.emptyText}>No datasets yet</div>
            <div style={styles.emptyHint}>Upload a CSV/TSV file or SEC filing PDF to get started</div>
          </div>
        ) : (
          <div style={styles.list}>
            {datasets.map((ds) => (
              <DatasetListItem
                key={ds.datasetId}
                dataset={ds}
                isAttached={attachedDatasetIds.includes(ds.datasetId)}
                onAttach={() => onAttach(ds.datasetId)}
                onDetach={() => onDetach(ds.datasetId)}
                onPreview={() => handlePreview(ds)}
                onImport={(sheetName) => handleImport(ds, sheetName)}
                onDelete={() => handleDatasetDelete(ds)}
                onBuildDb={() => handleBuildDb(ds)}
              />
            ))}
          </div>
        )
      ) : templates.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📋</div>
          <div style={styles.emptyText}>No templates yet</div>
          <div style={styles.emptyHint}>
            Upload an XLSX file with named ranges (DCF, LBO, etc.) to get started
          </div>
        </div>
      ) : (
        <div style={styles.list}>
          {templates.map((template) => (
            <TemplateListItem
              key={template.templateId}
              template={template}
              onUse={() => handleTemplateUse(template)}
              onView={() => handleTemplateView(template)}
              onDelete={() => handleTemplateDelete(template)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {previewDataset && (
        <DatasetPreviewModal
          dataset={previewDataset.meta}
          preview={previewDataset.preview}
          onClose={() => setPreviewDataset(null)}
        />
      )}

      {tickerPrompt && (
        <TickerInputModal
          filename={tickerPrompt.filename}
          onSubmit={handleTickerSubmit}
          onCancel={() => setTickerPrompt(null)}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: 16,
  },
  tabHeader: {
    display: 'flex',
    gap: 4,
    marginBottom: 16,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  tab: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#808080',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  activeTab: {
    color: '#e0e0e0',
    borderBottomColor: '#a78bfa',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  uploadBtn: {
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
  error: {
    backgroundColor: 'rgba(255,100,100,0.15)',
    border: '1px solid rgba(255,100,100,0.3)',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#ff6464',
    fontSize: 13,
  },
  errorClose: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    color: '#ff6464',
    cursor: 'pointer',
    padding: 0,
    width: 24,
    height: 24,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    opacity: 0.3,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 600,
    color: '#a0a0a0',
  },
  emptyHint: {
    fontSize: 13,
    color: '#808080',
  },
  list: {
    flex: 1,
    overflow: 'auto',
  },
}
