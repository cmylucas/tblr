/**
 * LLM tools for querying datasets via local DB (token-efficient)
 * These tools replace full dataset chunk reading with targeted queries
 */

import type { FunctionDefinition, FunctionResult } from './tools'
import { listDatasets, getDataset, getDatasetPath } from '../datasets/datasetStore'
import { openDatasetDb, searchCatalog as dbSearchCatalog, getSeries as dbGetSeries } from '../db/datasetDb'
import * as fs from 'fs'
import * as path from 'path'
import {
  addSheet,
  writeRange,
  formatRange,
  freezeRowsCols,
  indexToColLetter,
} from '../sheets/sheetsClient'

/**
 * Tool 1: list_datasets (enhanced with DB info)
 */
export const listDatasetsDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'list_datasets',
    description:
      'Lists all available datasets with metadata including DB status. Use this first to see what data is available.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
}

export async function executeListDatasets(): Promise<FunctionResult> {
  try {
    const datasets = listDatasets()

    if (datasets.length === 0) {
      return {
        result: 'No datasets available.',
        success: true,
      }
    }

    const summary = datasets.map((d) => {
      const sourceLabel = d.source.type === 'sec-filing' ? `SEC: ${d.source.secFiling?.ticker || d.source.secFiling?.cik}` : 'Uploaded'
      const dbStatus = (d as any).dbInfo ? '✓ DB-backed' : '✗ No DB'
      const hasSummary = (d as any).dbInfo?.summaryCreated ? '✓ Summary' : ''
      return `[${d.datasetId}] "${d.name}" - ${d.stats.rowCount.toLocaleString()} rows × ${d.stats.colCount} cols - Source: ${sourceLabel} - ${dbStatus} ${hasSummary}`
    })

    return {
      result: `Available datasets (${datasets.length}):\n${summary.join('\n')}\n\nℹ️ For large DB-backed datasets, use describe_dataset → search_catalog → get_series instead of reading full data.`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error listing datasets: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 2: describe_dataset
 */
export const describeDatasetDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'describe_dataset',
    description:
      'Get dataset schema, sample rows, and query recommendations. Use this before querying.',
    parameters: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'The dataset ID',
        },
      },
      required: ['dataset_id'],
    },
  },
}

export async function executeDescribeDataset(args: { dataset_id: string }): Promise<FunctionResult> {
  try {
    const meta = getDataset(args.dataset_id)
    if (!meta) {
      return {
        result: `Dataset ${args.dataset_id} not found`,
        success: false,
      }
    }

    const dbInfo = (meta as any).dbInfo
    const hasDb = dbInfo && fs.existsSync(dbInfo.dbPath)

    let description = `Dataset: "${meta.name}"\n`
    description += `Source: ${meta.source.type === 'sec-filing' ? `SEC Filing (${meta.source.secFiling?.ticker || meta.source.secFiling?.cik})` : 'Uploaded'}\n`
    description += `Rows: ${meta.stats.rowCount.toLocaleString()}, Columns: ${meta.stats.colCount}\n`
    description += `Columns: ${meta.stats.headers.join(', ')}\n\n`

    if (hasDb) {
      description += `✓ Database available at: ${path.basename(dbInfo.dbPath)}\n`
      description += `Available views: catalog, latest_facts, finance_summary\n\n`
      description += `Recommended workflow:\n`
      description += `1. search_catalog(dataset_id, "revenue") to find relevant tags\n`
      description += `2. get_series(dataset_id, taxonomy, tag, unit) to fetch specific time series\n`
      description += `3. export_to_sheet(dataset_id, mode="finance_summary_to_sheet") for quick demo\n`
    } else {
      description += `⚠️  No database available. Dataset is small enough for direct read.\n`
    }

    // Sample rows (first 3)
    const dataPath = getDatasetPath(args.dataset_id)
    const client = openDatasetDb(dbInfo.dbPath)
    const sampleResult = client.query('SELECT * FROM facts LIMIT 3')
    client.close()

    description += `\nSample rows:\n`
    description += JSON.stringify(sampleResult.rows, null, 2)

    return {
      result: description,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error describing dataset: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 3: search_catalog
 */
export const searchCatalogDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'search_catalog',
    description:
      'Search dataset catalog for tags/labels matching query. Returns metadata about available fields.',
    parameters: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'The dataset ID',
        },
        query: {
          type: 'string',
          description: 'Search term (e.g., "revenue", "assets", "income")',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 20)',
          default: 20,
        },
      },
      required: ['dataset_id', 'query'],
    },
  },
}

export async function executeSearchCatalog(args: {
  dataset_id: string
  query: string
  limit?: number
}): Promise<FunctionResult> {
  try {
    const meta = getDataset(args.dataset_id)
    if (!meta) {
      return { result: `Dataset ${args.dataset_id} not found`, success: false }
    }

    const dbInfo = (meta as any).dbInfo
    if (!dbInfo || !fs.existsSync(dbInfo.dbPath)) {
      return { result: 'Dataset does not have a queryable database', success: false }
    }

    const client = openDatasetDb(dbInfo.dbPath)
    const results = dbSearchCatalog(client, args.query, args.limit || 20)
    client.close()

    if (results.length === 0) {
      return {
        result: `No tags found matching "${args.query}"`,
        success: true,
      }
    }

    const formatted = results.map(r =>
      `${r.taxonomy}:${r.tag} (${r.unit}) - "${r.label}" - Years: ${r.min_year}-${r.max_year} (${r.obs_count} obs)`
    ).join('\n')

    return {
      result: `Found ${results.length} matching tags:\n${formatted}`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error searching catalog: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 4: get_series
 */
export const getSeriesDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'get_series',
    description:
      'Get a time series for a specific tag. Returns annual data points sorted by fiscal year.',
    parameters: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'The dataset ID',
        },
        taxonomy: {
          type: 'string',
          description: 'Taxonomy (e.g., "us-gaap", "dei")',
        },
        tag: {
          type: 'string',
          description: 'Tag name (e.g., "Revenues", "NetIncomeLoss")',
        },
        unit: {
          type: 'string',
          description: 'Unit (e.g., "USD", "shares")',
        },
        form: {
          type: 'string',
          description: 'Form type (default "10-K")',
          default: '10-K',
        },
        fiscal_period: {
          type: 'string',
          description: 'Fiscal period (default "FY")',
          default: 'FY',
        },
        years: {
          type: 'number',
          description: 'Number of years to fetch (default 5)',
          default: 5,
        },
      },
      required: ['dataset_id', 'taxonomy', 'tag', 'unit'],
    },
  },
}

export async function executeGetSeries(args: {
  dataset_id: string
  taxonomy: string
  tag: string
  unit: string
  form?: string
  fiscal_period?: string
  years?: number
}): Promise<FunctionResult> {
  try {
    const meta = getDataset(args.dataset_id)
    if (!meta) {
      return { result: `Dataset ${args.dataset_id} not found`, success: false }
    }

    const dbInfo = (meta as any).dbInfo
    if (!dbInfo || !fs.existsSync(dbInfo.dbPath)) {
      return { result: 'Dataset does not have a queryable database', success: false }
    }

    const client = openDatasetDb(dbInfo.dbPath)
    const results = dbGetSeries(
      client,
      args.taxonomy,
      args.tag,
      args.unit,
      args.form || '10-K',
      args.fiscal_period || 'FY',
      args.years || 5
    )
    client.close()

    if (results.length === 0) {
      return {
        result: `No data found for ${args.taxonomy}:${args.tag} (${args.unit})`,
        success: true,
      }
    }

    const formatted = results.map(r =>
      `FY${r.fiscal_year} (${r.end_date}): ${r.value?.toLocaleString() || 'N/A'}`
    ).join('\n')

    return {
      result: `${args.taxonomy}:${args.tag} time series (${results.length} points):\n${formatted}`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error fetching series: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 5: query_sql
 */
export const querySqlDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'query_sql',
    description:
      'Execute a custom SQL query on the dataset. Use tables: facts, latest_facts, catalog, finance_summary. SELECT only, max 5000 rows.',
    parameters: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'The dataset ID',
        },
        sql: {
          type: 'string',
          description: 'SELECT query (will be limited to 5000 rows)',
        },
      },
      required: ['dataset_id', 'sql'],
    },
  },
}

export async function executeQuerySql(args: { dataset_id: string; sql: string }): Promise<FunctionResult> {
  try {
    const meta = getDataset(args.dataset_id)
    if (!meta) {
      return { result: `Dataset ${args.dataset_id} not found`, success: false }
    }

    const dbInfo = (meta as any).dbInfo
    if (!dbInfo || !fs.existsSync(dbInfo.dbPath)) {
      return { result: 'Dataset does not have a queryable database', success: false }
    }

    const client = openDatasetDb(dbInfo.dbPath)
    const result = client.query(args.sql, [], 5000)
    client.close()

    if (result.rowCount === 0) {
      return {
        result: 'Query returned no rows',
        success: true,
      }
    }

    // Format as table
    const formatted = JSON.stringify(result.rows, null, 2)

    return {
      result: `Query returned ${result.rowCount} rows:\n${formatted.substring(0, 2000)}${formatted.length > 2000 ? '\n...(truncated)' : ''}`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error executing query: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 6: export_to_sheet
 */
export const exportToSheetDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'export_to_sheet',
    description:
      'Export dataset query results to Google Sheets. Mode "finance_summary" exports curated financial metrics.',
    parameters: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'The dataset ID',
        },
        mode: {
          type: 'string',
          description: 'Export mode',
          enum: ['finance_summary_to_sheet', 'custom_query_to_sheet'],
        },
        sheet_name: {
          type: 'string',
          description: 'Name for the new sheet tab',
        },
        custom_sql: {
          type: 'string',
          description: 'Custom SQL query (for custom_query_to_sheet mode)',
        },
      },
      required: ['dataset_id', 'mode', 'sheet_name'],
    },
  },
}

export async function executeExportToSheet(
  args: { dataset_id: string; mode: string; sheet_name: string; custom_sql?: string },
  getCurrentSpreadsheetId: () => string | undefined
): Promise<FunctionResult> {
  try {
    const spreadsheetId = getCurrentSpreadsheetId()
    if (!spreadsheetId) {
      return {
        result: 'No spreadsheet attached. User must attach a Google Sheet first.',
        success: false,
      }
    }

    const meta = getDataset(args.dataset_id)
    if (!meta) {
      return { result: `Dataset ${args.dataset_id} not found`, success: false }
    }

    const dbInfo = (meta as any).dbInfo
    if (!dbInfo || !fs.existsSync(dbInfo.dbPath)) {
      return { result: 'Dataset does not have a queryable database', success: false }
    }

    const client = openDatasetDb(dbInfo.dbPath)

    let rows: string[][]
    if (args.mode === 'finance_summary_to_sheet') {
      // Query finance_summary and pivot
      const result = client.query('SELECT * FROM finance_summary ORDER BY fiscal_year DESC, tag')
      if (result.rowCount === 0) {
        client.close()
        return { result: 'Finance summary is empty', success: false }
      }

      // Pivot: rows = tags, cols = years
      const data = result.rows as any[]
      const years = [...new Set(data.map(r => r.fiscal_year))].sort().reverse()
      const tags = [...new Set(data.map(r => r.tag))]

      rows = [['Metric', ...years.map(y => `FY${y}`)]]
      for (const tag of tags) {
        const row = [tag]
        for (const year of years) {
          const match = data.find(r => r.tag === tag && r.fiscal_year === year)
          row.push(match ? String(match.value || '') : '')
        }
        rows.push(row)
      }
    } else if (args.mode === 'custom_query_to_sheet') {
      if (!args.custom_sql) {
        client.close()
        return { result: 'custom_sql parameter required for custom_query_to_sheet mode', success: false }
      }

      const result = client.query(args.custom_sql, [], 5000)
      if (result.rowCount === 0) {
        client.close()
        return { result: 'Query returned no rows', success: false }
      }

      // Convert to 2D array
      const headers = Object.keys(result.rows[0])
      rows = [headers]
      for (const row of result.rows) {
        rows.push(headers.map(h => String(row[h] || '')))
      }
    } else {
      client.close()
      return { result: `Unknown mode: ${args.mode}`, success: false }
    }

    client.close()

    // Write to Google Sheets
    const colCount = rows[0].length
    await addSheet(spreadsheetId, args.sheet_name, {
      rowCount: Math.max(rows.length, 100),
      columnCount: Math.max(colCount, 26),
    })

    const endCol = indexToColLetter(colCount - 1)
    const range = `${args.sheet_name}!A1:${endCol}${rows.length}`
    await writeRange(spreadsheetId, range, rows)

    // Format header
    const headerRange = `${args.sheet_name}!A1:${endCol}1`
    await formatRange(spreadsheetId, headerRange, { bold: true })
    await freezeRowsCols(spreadsheetId, args.sheet_name, 1, 0)

    return {
      result: `Exported ${rows.length - 1} rows to sheet "${args.sheet_name}"`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error exporting to sheet: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Get all query tool definitions
 */
export function getQueryToolDefinitions(): FunctionDefinition[] {
  return [
    listDatasetsDefinition,
    describeDatasetDefinition,
    searchCatalogDefinition,
    getSeriesDefinition,
    querySqlDefinition,
    exportToSheetDefinition,
  ]
}

/**
 * Execute a query tool by name
 */
export async function executeQueryTool(
  toolName: string,
  args: any,
  getCurrentSpreadsheetId: () => string | undefined
): Promise<FunctionResult> {
  switch (toolName) {
    case 'list_datasets':
      return executeListDatasets()
    case 'describe_dataset':
      return executeDescribeDataset(args)
    case 'search_catalog':
      return executeSearchCatalog(args)
    case 'get_series':
      return executeGetSeries(args)
    case 'query_sql':
      return executeQuerySql(args)
    case 'export_to_sheet':
      return executeExportToSheet(args, getCurrentSpreadsheetId)
    default:
      return {
        result: `Unknown query tool: ${toolName}`,
        success: false,
      }
  }
}
