/**
 * Financial Data Parser
 * Transforms raw spreadsheet data (string[][]) into structured Transaction objects
 */

export interface Transaction {
  date: Date
  amount: number
  category: string
  description: string
  rawRow: string[]
}

export interface ColumnMapping {
  dateColumn: number
  amountColumn: number
  categoryColumn?: number
  descriptionColumn?: number
}

export interface ParseError {
  row: number
  column: number
  value: string
  reason: string
}

export interface ParseResult {
  transactions: Transaction[]
  errors: ParseError[]
  skipped: number
}

/**
 * Parse date from various formats
 * Supports: MM/DD/YYYY, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD (ISO 8601)
 */
function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null

  const trimmed = value.trim()

  // Try ISO 8601 format first (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [_, year, month, day] = isoMatch
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (!isNaN(date.getTime())) return date
  }

  // Try MM/DD/YYYY format
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const [_, month, day, year] = usMatch
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (!isNaN(date.getTime())) return date
  }

  // Try DD-MM-YYYY or DD/MM/YYYY format
  const euMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (euMatch) {
    const [_, day, month, year] = euMatch
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (!isNaN(date.getTime())) return date
  }

  // Try parsing with Date constructor as fallback
  const fallbackDate = new Date(trimmed)
  if (!isNaN(fallbackDate.getTime())) return fallbackDate

  return null
}

/**
 * Parse amount from string, handling currency symbols and commas
 */
function parseAmount(value: string): number | null {
  if (!value || value.trim() === '') return null

  // Remove currency symbols ($, €, £, etc.) and commas
  const cleaned = value.trim().replace(/[$€£¥,]/g, '')

  const amount = parseFloat(cleaned)
  if (isNaN(amount)) return null

  return amount
}

/**
 * Parse financial data from spreadsheet
 */
export function parseFinancialData(
  data: string[][],
  mapping: ColumnMapping,
  skipHeaderRows = 0
): ParseResult {
  const transactions: Transaction[] = []
  const errors: ParseError[] = []
  let skipped = 0

  // Skip header rows
  const dataToProcess = data.slice(skipHeaderRows)

  for (let i = 0; i < dataToProcess.length; i++) {
    const row = dataToProcess[i]
    const rowIndex = i + skipHeaderRows

    // Skip empty rows
    if (row.every((cell) => !cell || cell.trim() === '')) {
      skipped++
      continue
    }

    // Parse date (required)
    const dateValue = row[mapping.dateColumn] || ''
    const date = parseDate(dateValue)
    if (!date) {
      errors.push({
        row: rowIndex,
        column: mapping.dateColumn,
        value: dateValue,
        reason: 'Invalid or missing date',
      })
      continue
    }

    // Parse amount (required)
    const amountValue = row[mapping.amountColumn] || ''
    const amount = parseAmount(amountValue)
    if (amount === null) {
      errors.push({
        row: rowIndex,
        column: mapping.amountColumn,
        value: amountValue,
        reason: 'Invalid or missing amount',
      })
      continue
    }

    // Parse category (optional, default to 'Uncategorized')
    let category = 'Uncategorized'
    if (
      mapping.categoryColumn !== undefined &&
      row[mapping.categoryColumn]
    ) {
      category = row[mapping.categoryColumn].trim()
    }

    // Parse description (optional, default to empty string)
    let description = ''
    if (
      mapping.descriptionColumn !== undefined &&
      row[mapping.descriptionColumn]
    ) {
      description = row[mapping.descriptionColumn].trim()
    }

    transactions.push({
      date,
      amount,
      category,
      description,
      rawRow: row,
    })
  }

  return {
    transactions,
    errors,
    skipped,
  }
}

/**
 * Validate column mapping against data
 */
export function validateColumnMapping(
  data: string[][],
  mapping: ColumnMapping
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (data.length === 0) {
    errors.push('No data provided')
    return { valid: false, errors }
  }

  const maxColumns = Math.max(...data.map((row) => row.length))

  // Check date column
  if (
    mapping.dateColumn < 0 ||
    mapping.dateColumn >= maxColumns
  ) {
    errors.push(`Date column ${mapping.dateColumn} is out of range`)
  }

  // Check amount column
  if (
    mapping.amountColumn < 0 ||
    mapping.amountColumn >= maxColumns
  ) {
    errors.push(
      `Amount column ${mapping.amountColumn} is out of range`
    )
  }

  // Check optional category column
  if (
    mapping.categoryColumn !== undefined &&
    (mapping.categoryColumn < 0 ||
      mapping.categoryColumn >= maxColumns)
  ) {
    errors.push(
      `Category column ${mapping.categoryColumn} is out of range`
    )
  }

  // Check optional description column
  if (
    mapping.descriptionColumn !== undefined &&
    (mapping.descriptionColumn < 0 ||
      mapping.descriptionColumn >= maxColumns)
  ) {
    errors.push(
      `Description column ${mapping.descriptionColumn} is out of range`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
