/**
 * Type definitions for DCF template system
 */

export interface TemplateMeta {
  templateId: string // UUID
  name: string // "DCF - Tech Company"
  description?: string // Optional description
  category: 'dcf' | 'lbo' | 'comps' | 'merger' | 'other'

  // Google Drive info
  driveFileId: string // Original template file ID
  driveWebViewLink: string // Link to template

  // Template structure
  requiredInputs: string[] // Named range keys
  optionalInputs: string[]
  outputRanges: string[]

  // Validation rules
  validationRules: TemplateValidationRules

  // Metadata
  uploadedAt: number
  lastUsed?: number
  usageCount: number

  // Hash for version detection
  xlsxHash?: string // SHA256 of original XLSX
}

export interface TemplateValidationRules {
  percentageInputs: string[] // Must be 0-1
  positiveInputs: string[] // Must be > 0
  integerInputs: string[] // Must be integer
  requiredInputs: string[] // Cannot be null
}

export interface TemplateRun {
  runId: string // UUID
  templateId: string
  templateName: string

  // Output spreadsheet
  spreadsheetId: string
  spreadsheetUrl: string
  spreadsheetName: string

  // Inputs used
  inputs: Record<string, any>

  // Outputs captured
  outputs: Record<string, any>

  // Audit trail
  createdAt: number
  createdBy: 'user' | 'llm'
  llmPrompt?: string // If created by LLM

  // Status
  status: 'draft' | 'complete' | 'error'
  errorMessage?: string
}

/**
 * Standard DCF input ranges
 */
export const DCF_REQUIRED_INPUTS = [
  'company_name',
  'ticker',
  'wacc',
  'cost_of_equity',
  'cost_of_debt',
  'tax_rate',
  'terminal_growth',
  'start_year',
  'projection_years',
  'net_debt',
  'shares_outstanding',
  'revenue_y1',
  'revenue_y2',
  'revenue_y3',
  'revenue_y4',
  'revenue_y5',
]

export const DCF_OPTIONAL_INPUTS = [
  'minority_interest',
  'revenue_y6',
  'revenue_y7',
  'revenue_y8',
  'revenue_y9',
  'revenue_y10',
  'ebitda_margin_y1',
  'ebitda_margin_y2',
  'ebitda_margin_y3',
  'ebitda_margin_y4',
  'ebitda_margin_y5',
  'nwc_as_pct_revenue',
  'capex_as_pct_revenue',
]

export const DCF_OUTPUT_RANGES = [
  'enterprise_value',
  'equity_value',
  'implied_price_per_share',
  'dcf_date',
]

export const DCF_OPTIONAL_OUTPUTS = [
  'npv_fcf',
  'terminal_value',
  'pv_terminal_value',
  'upside_downside_pct',
]

/**
 * Default validation rules for DCF templates
 */
export const DCF_VALIDATION_RULES: TemplateValidationRules = {
  percentageInputs: [
    'wacc',
    'cost_of_equity',
    'cost_of_debt',
    'tax_rate',
    'terminal_growth',
    'ebitda_margin_y1',
    'ebitda_margin_y2',
    'ebitda_margin_y3',
    'ebitda_margin_y4',
    'ebitda_margin_y5',
    'nwc_as_pct_revenue',
    'capex_as_pct_revenue',
  ],
  positiveInputs: [
    'shares_outstanding',
    'projection_years',
    'revenue_y1',
    'revenue_y2',
    'revenue_y3',
    'revenue_y4',
    'revenue_y5',
  ],
  integerInputs: ['start_year', 'projection_years'],
  requiredInputs: DCF_REQUIRED_INPUTS,
}
