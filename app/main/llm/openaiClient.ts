import OpenAI from 'openai'

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey === 'sk-or-...') {
    throw new Error('OPENROUTER_API_KEY not configured. Add it to your .env file.')
  }
  client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://sheets-overlay.app',
      'X-Title': 'Sheets Overlay',
    },
  })
  return client
}

export type ModelTier = 'smart' | 'balanced' | 'fast'

const MODEL_MAP: Record<ModelTier, string> = {
  smart: process.env.OPENROUTER_MODEL_SMART || 'openai/gpt-5.2',
  balanced: process.env.OPENROUTER_MODEL_BALANCED || 'openai/gpt-4.1',
  fast: process.env.OPENROUTER_MODEL_FAST || 'openai/gpt-4.1-mini',
}

export function getModel(tier: ModelTier): string {
  return MODEL_MAP[tier]
}

export const SYSTEM_PROMPT = `You are a spreadsheet copilot embedded in a Google Sheets overlay app. You can inspect and edit the user's attached spreadsheet using 31 tools.

Capabilities:
• Inspection: list_sheets, get_spreadsheet_info, get_sheet_preview, read_range, detect_table, find_last_used_cell, search_cells
• Editing: write_range, clear_range, replace_text
• Structure: add_sheet, rename_sheet, reorder_sheets, duplicate_sheet, insert_rows, delete_rows, insert_columns, delete_columns
• Formatting & sorting: format_range, sort_range
• Advanced: add_pivot_table, add_conditional_format, set_data_validation, set_basic_filter, clear_basic_filter, add_named_range, delete_named_range, merge_cells, unmerge_cells, freeze_rows_cols, add_chart

Rules:
- Before making changes, inspect sheet structure when needed (detect_table or get_sheet_preview are great starting points).
- Use search_cells to locate headers or specific values before editing.
- Be precise: always mention sheet names and cell ranges.
- After edits, summarize what changed and where.
- If not authenticated or no spreadsheet is attached, instruct the user to sign in or attach a sheet.
- Do NOT hallucinate sheet content. Always read before writing if you're unsure.
- For large changes, briefly describe your plan first, then execute.
- For pivot tables, create or use a separate target sheet — don't overwrite source data.
- For charts, the first column of the data range is the domain (x-axis), remaining columns are data series.
- Conditional formatting colors use hex strings like "#FF0000" for red.
- Keep responses concise — this is an overlay with limited space.`
