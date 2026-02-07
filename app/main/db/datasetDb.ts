/**
 * Dataset database management
 * Creates and manages SQLite databases for large SEC datasets
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { SqliteClient } from './sqliteClient'
import { parseFile } from '../attachments/parseCsvTsv'

export interface DatasetDbInfo {
  dbPath: string
  rowCount: number
  indexesCreated: boolean
  summaryCreated: boolean
  catalogCreated: boolean
}

/**
 * Create a database for a dataset and import CSV data
 */
export function createDatasetDb(datasetId: string, csvPath: string): DatasetDbInfo {
  const dbDir = path.join(app.getPath('userData'), 'db')
  fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, `${datasetId}.db`)

  console.log(`[datasetDb] Creating database at ${dbPath}`)

  const client = new SqliteClient(dbPath)

  try {
    // Create facts table
    client.exec(`
      CREATE TABLE IF NOT EXISTS facts (
        cik TEXT NOT NULL,
        entity_name TEXT,
        taxonomy TEXT NOT NULL,
        tag TEXT NOT NULL,
        label TEXT,
        unit TEXT NOT NULL,
        value REAL,
        end_date TEXT,
        fiscal_year INTEGER,
        fiscal_period TEXT,
        form TEXT,
        filed_date TEXT,
        accession_number TEXT
      )
    `)

    // Import CSV data
    console.log(`[datasetDb] Importing CSV data from ${csvPath}`)
    const { rows } = parseFile(csvPath)

    if (rows.length === 0) {
      throw new Error('CSV file is empty')
    }

    // First row is headers, skip it
    const dataRows = rows.slice(1)

    // Bulk insert with transaction
    const insertStmt = client.prepare(`
      INSERT INTO facts (
        cik, entity_name, taxonomy, tag, label, unit, value,
        end_date, fiscal_year, fiscal_period, form, filed_date, accession_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    client.transaction(() => {
      for (const row of dataRows) {
        // Parse fiscal_year and value as numbers
        const fiscalYear = row[8] ? parseInt(row[8], 10) : null
        const value = row[6] ? parseFloat(row[6]) : null

        insertStmt.run(
          row[0] || '',  // cik
          row[1] || '',  // entity_name
          row[2] || '',  // taxonomy
          row[3] || '',  // tag
          row[4] || '',  // label
          row[5] || '',  // unit
          value,         // value
          row[7] || '',  // end_date
          fiscalYear,    // fiscal_year
          row[9] || '',  // fiscal_period
          row[10] || '', // form
          row[11] || '', // filed_date
          row[12] || ''  // accession_number
        )
      }
    })

    console.log(`[datasetDb] Imported ${dataRows.length} rows`)

    // Create indexes
    createIndexes(client)

    // Create views
    createViews(client)

    // Create finance summary
    const summaryCreated = createFinanceSummary(client)

    client.close()

    return {
      dbPath,
      rowCount: dataRows.length,
      indexesCreated: true,
      summaryCreated,
      catalogCreated: true,
    }
  } catch (err) {
    client.close()
    // Clean up db file on error
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
    throw err
  }
}

/**
 * Create indexes for common queries
 */
function createIndexes(client: SqliteClient): void {
  console.log('[datasetDb] Creating indexes...')

  client.exec(`
    CREATE INDEX IF NOT EXISTS idx_facts_tag ON facts(tag);
    CREATE INDEX IF NOT EXISTS idx_facts_taxonomy_tag ON facts(taxonomy, tag);
    CREATE INDEX IF NOT EXISTS idx_facts_fiscal_year ON facts(fiscal_year);
    CREATE INDEX IF NOT EXISTS idx_facts_form_fp ON facts(form, fiscal_period);
    CREATE INDEX IF NOT EXISTS idx_facts_filed_date ON facts(filed_date);
  `)

  console.log('[datasetDb] Indexes created')
}

/**
 * Create views for efficient querying
 */
function createViews(client: SqliteClient): void {
  console.log('[datasetDb] Creating views...')

  // 1. latest_facts view - deduped to latest filing
  client.exec(`
    CREATE VIEW IF NOT EXISTS latest_facts AS
    SELECT
      cik, entity_name, taxonomy, tag, label, unit, value,
      end_date, fiscal_year, fiscal_period, form, filed_date, accession_number
    FROM (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY taxonomy, tag, unit, fiscal_year, fiscal_period, COALESCE(end_date, '')
          ORDER BY filed_date DESC
        ) AS rn
      FROM facts
    )
    WHERE rn = 1
  `)

  // 2. catalog view - tag catalog
  client.exec(`
    CREATE VIEW IF NOT EXISTS catalog AS
    SELECT
      taxonomy,
      tag,
      unit,
      MAX(label) as label,
      MIN(fiscal_year) as min_year,
      MAX(fiscal_year) as max_year,
      COUNT(*) as obs_count,
      MAX(filed_date) as latest_filed
    FROM facts
    WHERE fiscal_year IS NOT NULL
    GROUP BY taxonomy, tag, unit
    ORDER BY taxonomy, tag, unit
  `)

  console.log('[datasetDb] Views created')
}

/**
 * Create finance_summary table with common tags
 */
function createFinanceSummary(client: SqliteClient): boolean {
  console.log('[datasetDb] Creating finance_summary...')

  const commonTags = [
    'Revenues',
    'CostOfRevenue',
    'GrossProfit',
    'OperatingIncomeLoss',
    'NetIncomeLoss',
    'Assets',
    'Liabilities',
    'StockholdersEquity',
    'CashAndCashEquivalentsAtCarryingValue',
    'NetCashProvidedByUsedInOperatingActivities',
    'EntityCommonStockSharesOutstanding',
  ]

  // Create finance_summary table
  client.exec(`
    CREATE TABLE IF NOT EXISTS finance_summary (
      fiscal_year INTEGER NOT NULL,
      fiscal_period TEXT NOT NULL,
      tag TEXT NOT NULL,
      label TEXT,
      unit TEXT NOT NULL,
      value REAL,
      end_date TEXT,
      filed_date TEXT,
      form TEXT,
      PRIMARY KEY (fiscal_year, fiscal_period, tag, unit)
    )
  `)

  // Insert common tags from latest_facts
  const tagList = commonTags.map(t => `'${t}'`).join(',')

  client.exec(`
    INSERT OR REPLACE INTO finance_summary
    SELECT
      fiscal_year,
      fiscal_period,
      tag,
      label,
      unit,
      value,
      end_date,
      filed_date,
      form
    FROM latest_facts
    WHERE form = '10-K'
      AND fiscal_period = 'FY'
      AND tag IN (${tagList})
      AND fiscal_year >= (SELECT MAX(fiscal_year) - 4 FROM latest_facts)
    ORDER BY fiscal_year DESC, tag
  `)

  const result = client.query('SELECT COUNT(*) as cnt FROM finance_summary')
  const count = result.rows[0]?.cnt || 0

  console.log(`[datasetDb] Finance summary created with ${count} rows`)

  return count > 0
}

/**
 * Open an existing dataset database
 */
export function openDatasetDb(dbPath: string): SqliteClient {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`)
  }
  return new SqliteClient(dbPath)
}

/**
 * Search catalog for tags/labels matching query
 */
export function searchCatalog(client: SqliteClient, query: string, limit: number = 20): any[] {
  const searchTerm = `%${query}%`
  const result = client.query(
    `
    SELECT taxonomy, tag, unit, label, min_year, max_year, obs_count, latest_filed
    FROM catalog
    WHERE LOWER(tag) LIKE LOWER(?) OR LOWER(label) LIKE LOWER(?)
    ORDER BY obs_count DESC
    `,
    [searchTerm, searchTerm],
    limit
  )
  return result.rows
}

/**
 * Get a time series for a specific tag
 */
export function getSeries(
  client: SqliteClient,
  taxonomy: string,
  tag: string,
  unit: string,
  form: string = '10-K',
  fp: string = 'FY',
  years: number = 5
): any[] {
  const result = client.query(
    `
    SELECT fiscal_year, fiscal_period, end_date, value, filed_date, accession_number
    FROM latest_facts
    WHERE taxonomy = ?
      AND tag = ?
      AND unit = ?
      AND form = ?
      AND fiscal_period = ?
      AND fiscal_year >= (SELECT MAX(fiscal_year) - ? FROM latest_facts)
    ORDER BY fiscal_year ASC
    `,
    [taxonomy, tag, unit, form, fp, years - 1],
    years
  )
  return result.rows
}
