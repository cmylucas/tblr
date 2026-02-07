import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { getOpenAIClient, getModel, SYSTEM_PROMPT, DEFAULT_MODEL } from './openaiClient'
import { toolDefinitions, executeTool } from './tools'
import { getDatasetToolDefinitions, executeDatasetTool } from './datasetTools'
import { getQueryToolDefinitions, executeQueryTool } from './queryTools'
import { getTemplateToolDefinitions, executeTemplateTool } from './templateTools'
import { listDatasets } from '../datasets/datasetStore'
import type { ChatMessage, ToolAction, ChatResponse } from '../shared/types'

const MAX_TOOL_CALLS_PER_TURN = 300

/**
 * Get an icon emoji for a tool name
 */
function getToolIcon(toolName: string): string {
  if (toolName.includes('read') || toolName.includes('get') || toolName.includes('list')) return '📖'
  if (toolName.includes('write') || toolName.includes('update') || toolName.includes('set')) return '✏️'
  if (toolName.includes('add') || toolName.includes('create')) return '➕'
  if (toolName.includes('delete') || toolName.includes('remove')) return '🗑️'
  if (toolName.includes('import')) return '📥'
  if (toolName.includes('export')) return '📤'
  if (toolName.includes('format')) return '🎨'
  if (toolName.includes('chart') || toolName.includes('graph')) return '📊'
  if (toolName.includes('dataset')) return '📊'
  if (toolName.includes('sheet')) return '📄'
  return '🔧'
}

/**
 * Format a tool name to be more human-readable
 */
function formatToolName(toolName: string): string {
  // Convert snake_case to Title Case
  return toolName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Build a short context block listing attached datasets for the system prompt.
 */
function buildDatasetContext(): string {
  const datasets = listDatasets()
  if (datasets.length === 0) return ''

  const dbDatasets = datasets.filter(d => d.dbInfo)
  const regularDatasets = datasets.filter(d => !d.dbInfo)

  let msg = '\n\nUser has attached datasets:\n'

  if (dbDatasets.length > 0) {
    const dbItems = dbDatasets
      .map((d) => {
        const source = d.source.type === 'sec-filing' ? `SEC: ${d.source.secFiling?.ticker || d.source.secFiling?.cik}` : 'Uploaded'
        const summary = d.dbInfo?.summaryCreated ? ' [finance_summary available]' : ''
        return `  • ${d.datasetId}: ${d.name} (${source}, ${d.stats.rowCount} rows × ${d.stats.colCount} cols, DB-backed${summary})`
      })
      .join('\n')
    msg += dbItems + '\n'
    msg += '\nFor DB-backed datasets, ALWAYS use query tools to avoid token burn:\n'
    msg += '  • describe_dataset: Get schema, sample rows, and query recommendations\n'
    msg += '  • search_catalog: Search for specific tags/fields\n'
    msg += '  • get_series: Get time series for a specific tag\n'
    msg += '  • query_sql: Run custom SQL queries (5000 row limit)\n'
    msg += '  • export_to_sheet: Export finance_summary or query results to Google Sheets\n'
    msg += 'NEVER use read_dataset_chunk on DB-backed datasets - use query tools instead!\n'
  }

  if (regularDatasets.length > 0) {
    const regularItems = regularDatasets
      .map((d) => {
        const source = d.source.type === 'sec-filing' ? `SEC: ${d.source.secFiling?.ticker || d.source.secFiling?.cik}` : 'Uploaded'
        return `  • ${d.datasetId}: ${d.name} (${source}, ${d.stats.rowCount} rows × ${d.stats.colCount} cols)`
      })
      .join('\n')
    if (dbDatasets.length > 0) msg += '\nRegular datasets:\n'
    msg += regularItems + '\n'
    msg += '\nFor regular datasets, use: get_dataset_preview, read_dataset_chunk, import_dataset_to_sheet'
  }

  return msg
}

/**
 * Run the chat-with-tools loop:
 * 1. Send conversation to OpenAI-compatible API (OpenRouter)
 * 2. If model returns tool_calls, execute them and loop
 * 3. Return final assistant message + list of actions taken
 *
 * onProgress is called with 'thinking' (waiting for LLM) or 'applying' (executing tools).
 */
export async function runAgent(
  history: ChatMessage[],
  spreadsheetId: string | undefined,
  sheetNames: string[],
  modelId: string = DEFAULT_MODEL,
  onProgress?: (status: string) => void,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const openai = getOpenAIClient()
  const model = getModel(modelId)
  const actions: ToolAction[] = []

  // Combine sheet tools + dataset tools + query tools + template tools
  const datasetTools = getDatasetToolDefinitions()
  const queryTools = getQueryToolDefinitions()
  const templateTools = getTemplateToolDefinitions()
  const allTools = [...toolDefinitions, ...datasetTools, ...queryTools, ...templateTools]

  const systemContent = SYSTEM_PROMPT + buildDatasetContext()

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  let toolCallCount = 0

  while (true) {
    if (signal?.aborted) {
      return { message: '(Stopped by user.)', actions }
    }

    onProgress?.('💭 Thinking...')
    console.log(`[agent] calling ${model} (${messages.length} msgs, ${toolCallCount} tool calls so far)`)

    const completion = await openai.chat.completions.create({
      model,
      messages,
      tools: allTools,
      tool_choice: 'auto',
    }, { signal })

    const choice = completion.choices[0]
    if (!choice) {
      return { message: 'No response from AI.', actions }
    }

    const msg = choice.message

    // If no tool calls, we have a final assistant reply
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { message: msg.content ?? '', actions }
    }

    // Guard: max tool calls
    if (toolCallCount + msg.tool_calls.length > MAX_TOOL_CALLS_PER_TURN) {
      return {
        message:
          (msg.content ?? '') +
          '\n\n(This task required many steps. Send another message to continue where I left off.)',
        actions,
      }
    }

    messages.push(msg as ChatCompletionMessageParam)

    for (const tc of msg.tool_calls) {
      if (signal?.aborted) {
        return { message: '(Stopped by user.)', actions }
      }
      toolCallCount++
      const toolName = tc.function.name
      const toolArgs = tc.function.arguments

      // Send detailed progress for each tool
      const toolIcon = getToolIcon(toolName)
      onProgress?.(`${toolIcon} ${formatToolName(toolName)}`)

      console.log(`[agent] tool #${toolCallCount}: ${toolName}(${toolArgs.substring(0, 200)})`)

      // Route to dataset tools, query tools, template tools, or sheet tools
      const datasetToolNames = new Set(['get_dataset_preview', 'read_dataset_chunk', 'import_dataset_to_sheet'])
      const queryToolNames = new Set(['list_datasets', 'describe_dataset', 'search_catalog', 'get_series', 'query_sql', 'export_to_sheet'])
      const templateToolNames = new Set(['list_templates', 'describe_template', 'create_model_from_template', 'set_template_inputs', 'read_template_outputs'])
      let result: string
      let success: boolean
      if (datasetToolNames.has(toolName)) {
        const args = JSON.parse(toolArgs)
        const r = await executeDatasetTool(toolName, args, () => spreadsheetId)
        result = r.result
        success = r.success
      } else if (queryToolNames.has(toolName)) {
        const args = JSON.parse(toolArgs)
        const r = await executeQueryTool(toolName, args, () => spreadsheetId)
        result = r.result
        success = r.success
      } else if (templateToolNames.has(toolName)) {
        const args = JSON.parse(toolArgs)
        const r = await executeTemplateTool(toolName, args, (id: string) => { spreadsheetId = id })
        result = r.result
        success = r.success
      } else {
        const r = await executeTool(toolName, toolArgs, spreadsheetId, sheetNames)
        result = r.result
        success = r.success
      }

      let parsedToolArgs: Record<string, unknown> = {}
      try {
        parsedToolArgs = JSON.parse(toolArgs)
      } catch {
        parsedToolArgs = { raw: toolArgs }
      }

      actions.push({
        tool: toolName,
        args: parsedToolArgs,
        result: result.length > 500 ? result.substring(0, 500) + '...(truncated)' : result,
        success,
      })

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      })
    }
  }
}
