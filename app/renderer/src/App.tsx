import React, { useEffect, useState, useCallback } from 'react'
import type { AppStatus, ChatMessage } from '../../main/shared/types'
import type { AttachmentMeta, CsvPreview } from '../../main/attachments/types'
import type { DatasetMeta } from '../../main/datasets/datasetTypes'
import type { TemplateMeta } from '../../main/templates/templateTypes'
import StatusBar from './components/StatusBar'
import MessageList, { type DisplayMessage } from './components/MessageList'
import MessageInput from './components/MessageInput'
import AuditLog from './components/AuditLog'
import ImportCsvModal from './components/ImportCsvModal'
import FilesTab from './components/FilesTab'

const api = window.sheetsOverlay

let msgIdCounter = 0
function nextId(): string {
  return `msg-${++msgIdCounter}-${Date.now()}`
}

export interface ModelOption {
  id: string
  label: string
  desc: string
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'openai/gpt-5.2', label: 'GPT-5.2', desc: 'Most capable OpenAI' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1', desc: 'Balanced OpenAI' },
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', desc: 'Fast & cheap OpenAI' },
  { id: 'anthropic/claude-opus-4', label: 'Claude Opus', desc: 'Most capable Anthropic' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet', desc: 'Balanced Anthropic' },
  { id: 'anthropic/claude-haiku-3.5', label: 'Claude Haiku', desc: 'Fast Anthropic' },
]

type Tab = 'chat' | 'files' | 'logs'

export default function App() {
  const [status, setStatus] = useState<AppStatus>({
    signedIn: false,
    attached: false,
  })
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string>('thinking')
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('openai/gpt-4.1')
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [detectedSheetUrl, setDetectedSheetUrl] = useState<string | null>(null)

  // Attachment state
  const [attachedFiles, setAttachedFiles] = useState<AttachmentMeta[]>([])
  const [csvModal, setCsvModal] = useState<{ meta: AttachmentMeta; preview: CsvPreview } | null>(null)
  const [importing, setImporting] = useState(false)

  // Dataset state
  const [datasets, setDatasets] = useState<DatasetMeta[]>([])
  const [attachedDatasetIds, setAttachedDatasetIds] = useState<string[]>([])

  // Template state
  const [templates, setTemplates] = useState<TemplateMeta[]>([])

  const refreshStatus = useCallback(async () => {
    const res = await api.getStatus()
    if (res.ok && res.data) {
      setStatus(res.data)
      if (res.data.attached) setDetectedSheetUrl(null)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, 5000)
    return () => clearInterval(id)
  }, [refreshStatus])

  useEffect(() => {
    const cleanup = api.onChatProgress((status) => {
      setLoadingStatus(status)
    })
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = api.onSheetDetected((url) => {
      setDetectedSheetUrl(url)
    })
    return cleanup
  }, [])

  // Load datasets on mount
  const refreshDatasets = useCallback(async () => {
    const res = await api.listDatasets()
    if (res.ok && res.data) {
      setDatasets(res.data)
    }
  }, [])

  useEffect(() => {
    refreshDatasets()
  }, [refreshDatasets])

  // Load templates on mount
  const refreshTemplates = useCallback(async () => {
    const res = await api.listTemplates()
    if (res.ok && res.data) {
      setTemplates(res.data)
    }
  }, [])

  useEffect(() => {
    refreshTemplates()
  }, [refreshTemplates])

  // ── Attachment flow ──

  const handleAttachFile = useCallback(async () => {
    try {
      const res = await api.openAttachmentDialog()
      if (!res.ok) {
        if (res.error !== 'No file selected') setError(res.error ?? 'Failed to open file')
        return
      }
      const meta = res.data!

      if (meta.type === 'csv' || meta.type === 'tsv') {
        // Get preview and show modal
        const previewRes = await api.getAttachmentPreview(meta.fileId)
        if (!previewRes.ok) {
          setError(previewRes.error ?? 'Failed to preview file')
          return
        }
        setCsvModal({ meta, preview: previewRes.data! as CsvPreview })
      } else if (meta.type === 'pdf') {
        // Get preview to check text layer
        const previewRes = await api.getAttachmentPreview(meta.fileId)
        if (!previewRes.ok) {
          setError(previewRes.error ?? 'Failed to process PDF')
          await api.removeAttachment(meta.fileId)
          return
        }

        // Add to attached files
        setAttachedFiles((prev) => [...prev, meta])

        // Inject assistant message asking what to do
        const assistantMsg: DisplayMessage = {
          id: nextId(),
          role: 'assistant',
          content: `PDF attached: "${meta.name}". This will send extracted text from your PDF to the AI model to process.\n\nWhat would you like me to do with it? For example:\n- Extract transactions into a new sheet\n- Summarize the document\n- Answer questions about the content\n- Find totals by category or month`,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMsg])
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: assistantMsg.content },
        ])
      }
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  const handleCsvAttachToLlm = useCallback(() => {
    if (!csvModal) return
    const { meta } = csvModal

    setAttachedFiles((prev) => [...prev, meta])
    setCsvModal(null)

    // Inject assistant message
    const assistantMsg: DisplayMessage = {
      id: nextId(),
      role: 'assistant',
      content: `Attached "${meta.name}" (${meta.type.toUpperCase()}). Ask me what to do with it — I can analyze the data, create summaries, or import it into a new sheet.`,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, assistantMsg])
    setChatHistory((prev) => [
      ...prev,
      { role: 'assistant', content: assistantMsg.content },
    ])
  }, [csvModal])

  const handleCsvImportToSheets = useCallback(async (sheetName: string) => {
    if (!csvModal) return
    const { meta } = csvModal

    setImporting(true)
    try {
      const res = await api.importCsvToSheet(meta.fileId, sheetName)
      if (!res.ok) {
        setError(res.error ?? 'Import failed')
        setImporting(false)
        return
      }
      const data = res.data!
      setCsvModal(null)

      // Inject confirmation message
      const assistantMsg: DisplayMessage = {
        id: nextId(),
        role: 'assistant',
        content: `Imported "${meta.name}" into sheet "${data.sheetName}" — ${data.rowsWritten.toLocaleString()} rows, ${data.colsWritten} columns. Header row is bold and frozen, filter is applied.`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: assistantMsg.content },
      ])

      refreshStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }, [csvModal, refreshStatus])

  const handleRemoveAttachment = useCallback(async (fileId: string) => {
    await api.removeAttachment(fileId)
    setAttachedFiles((prev) => prev.filter((f) => f.fileId !== fileId))
  }, [])

  const handleAbort = useCallback(() => {
    api.abortChat()
    setLoading(false)
  }, [])

  // ── Chat send ──

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: DisplayMessage = {
        id: nextId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)
      setLoadingStatus('thinking')
      setError(null)

      try {
        const res = await api.sendChat(chatHistory, text, selectedModel)

        if (!res.ok) {
          setError(res.error ?? 'Chat failed')
          setLoading(false)
          return
        }

        const data = res.data!
        const assistantMsg: DisplayMessage = {
          id: nextId(),
          role: 'assistant',
          content: data.message,
          actions: data.actions,
          timestamp: Date.now(),
        }

        setMessages((prev) => [...prev, assistantMsg])

        setChatHistory((prev) => [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: data.message },
        ])

        refreshStatus()
      } catch (err: any) {
        setError(err.message ?? 'Chat failed')
      } finally {
        setLoading(false)
      }
    },
    [chatHistory, refreshStatus, selectedModel]
  )

  return (
    <div style={styles.shell}>
      <StatusBar
        status={status}
        onRefresh={refreshStatus}
        onError={setError}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        detectedSheetUrl={detectedSheetUrl}
        onDismissDetected={() => {
          if (detectedSheetUrl) {
            api.dismissDetectedSheet(detectedSheetUrl)
            setDetectedSheetUrl(null)
          }
        }}
      />

      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'chat' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('chat')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
          Chat
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'files' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('files')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z" />
          </svg>
          Files
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'logs' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('logs')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z" />
          </svg>
          Logs
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          <span style={styles.errorText}>{error}</span>
          <button onClick={() => setError(null)} style={styles.dismissBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      )}

      {activeTab === 'chat' ? (
        <>
          <div style={styles.messagesArea}>
            <MessageList messages={messages} loading={loading} loadingStatus={loadingStatus} />
          </div>
          <MessageInput
            onSend={handleSend}
            onAttachFile={handleAttachFile}
            onAbort={handleAbort}
            disabled={loading}
            attachedFiles={attachedFiles}
            attachedDatasets={datasets.filter((d) => attachedDatasetIds.includes(d.datasetId))}
            onRemoveAttachment={handleRemoveAttachment}
            onRemoveDataset={(id) => setAttachedDatasetIds((prev) => prev.filter((did) => did !== id))}
          />
        </>
      ) : activeTab === 'files' ? (
        <div style={styles.messagesArea}>
          <FilesTab
            datasets={datasets}
            attachedDatasetIds={attachedDatasetIds}
            templates={templates}
            onRefresh={refreshDatasets}
            onRefreshTemplates={refreshTemplates}
            onAttach={(id) => setAttachedDatasetIds((prev) => [...prev, id])}
            onDetach={(id) => setAttachedDatasetIds((prev) => prev.filter((did) => did !== id))}
          />
        </div>
      ) : (
        <div style={styles.messagesArea}>
          <AuditLog />
        </div>
      )}

      {/* CSV/TSV Import Modal */}
      {csvModal && (
        <ImportCsvModal
          fileName={csvModal.meta.name}
          preview={csvModal.preview}
          onAttachToLlm={handleCsvAttachToLlm}
          onImportToSheets={handleCsvImportToSheets}
          onCancel={() => {
            api.removeAttachment(csvModal.meta.fileId)
            setCsvModal(null)
          }}
          importing={importing}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    color: '#e0e0e0',
    background: 'rgba(20, 20, 22, 0.88)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    border: '1px solid rgba(29,185,84,0.08)',
  },
  tabBar: {
    display: 'flex',
    gap: 2,
    padding: '0 12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    flexShrink: 0,
    background: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    padding: '7px 0',
    border: 'none',
    background: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: 'rgba(255,255,255,0.85)',
    borderBottom: '2px solid rgba(29,185,84,0.7)',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  error: {
    background: 'rgba(255,68,68,0.15)',
    border: '1px solid rgba(255,68,68,0.3)',
    color: '#ff6b6b',
    padding: '6px 10px',
    margin: '0 12px',
    borderRadius: 8,
    fontSize: 11,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  errorText: { flex: 1, lineHeight: 1.3 },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#ff6b6b',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
}
