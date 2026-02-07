import * as fs from 'fs'

export interface CompanyFacts {
  cik: string
  entityName: string
  facts: {
    [taxonomy: string]: {
      // 'us-gaap', 'dei', etc.
      [tag: string]: {
        label: string
        description: string
        units: {
          [unit: string]: Array<{
            end?: string // Date (YYYY-MM-DD)
            val: number
            accn?: string // Accession number
            fy?: number // Fiscal year
            fp?: string // Fiscal period (Q1, Q2, Q3, FY)
            form?: string // Form type (10-K, 10-Q, etc.)
            filed?: string // Filing date
            frame?: string // Reporting frame
          }>
        }
      }
    }
  }
}

/**
 * Flatten companyfacts XBRL JSON to a 2D array of CSV rows.
 * Each row represents one fact observation (taxonomy + tag + unit + value + metadata).
 */
export function flattenCompanyFactsToCsv(facts: CompanyFacts): string[][] {
  const rows: string[][] = []

  // Header row
  rows.push([
    'cik',
    'entity_name',
    'taxonomy',
    'tag',
    'label',
    'unit',
    'value',
    'end_date',
    'fiscal_year',
    'fiscal_period',
    'form',
    'filed_date',
    'accession_number',
  ])

  // Iterate all taxonomies → tags → units → values
  for (const [taxonomy, tags] of Object.entries(facts.facts)) {
    for (const [tag, tagData] of Object.entries(tags)) {
      for (const [unit, values] of Object.entries(tagData.units)) {
        for (const val of values) {
          rows.push([
            facts.cik,
            facts.entityName,
            taxonomy,
            tag,
            tagData.label || '',
            unit,
            String(val.val),
            val.end || '',
            val.fy ? String(val.fy) : '',
            val.fp || '',
            val.form || '',
            val.filed || '',
            val.accn || '',
          ])
        }
      }
    }
  }

  console.log(`[csvFlattener] Flattened ${rows.length - 1} fact observations`)
  return rows
}

/**
 * Write CSV rows to a file with RFC 4180 quoting.
 */
export function writeCsvFile(rows: string[][], filePath: string): void {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          // Ensure cell is a string
          const cellStr = String(cell ?? '')
          // Quote cells with commas, quotes, or newlines
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        })
        .join(',')
    )
    .join('\n')

  fs.writeFileSync(filePath, csvContent, 'utf-8')
  console.log(`[csvFlattener] Wrote ${rows.length} rows to ${filePath}`)
}
