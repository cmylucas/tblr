/**
 * LLM tools for dataset operations.
 * Replaces attachment tools with dataset-focused tools.
 */

import type { FunctionDefinition, FunctionResult } from './tools'
import {
  listDatasets,
  getDataset,
  getDatasetPreview,
  readDatasetChunk,
  getDatasetPath,
} from '../datasets/datasetStore'
import { parseFile } from '../attachments/parseCsvTsv'
import {
  addSheet,
  writeRange,
  formatRange,
  freezeRowsCols,
  setBasicFilter,
  indexToColLetter,
} from '../sheets/sheetsClient'

/**
 * Tool 1: list_datasets
 * Lists all available datasets with metadata
 */
export const listDatasetsDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'list_datasets',
    description:
      'Lists all available datasets (CSV/TSV tables). Use this to see what data is available before reading or importing.',
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
        result: 'No datasets available. User needs to upload datasets in the Files tab first.',
        success: true,
      }
    }

    const summary = datasets.map((d) => {
      const sourceLabel = d.source.type === 'sec-filing' ? `SEC Filing (${d.source.secFiling?.ticker || d.source.secFiling?.cik})` : 'Uploaded'
      return `[${d.datasetId}] "${d.name}" - ${d.stats.rowCount} rows × ${d.stats.colCount} cols - Source: ${sourceLabel}`
    })

    return {
      result: `Available datasets (${datasets.length}):\n${summary.join('\n')}`,
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
 * Tool 2: get_dataset_preview
 * Get headers and sample rows from a dataset
 */
export const getDatasetPreviewDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'get_dataset_preview',
    description:
      'Get a preview of a dataset (headers and first 20 rows). Use this to understand the structure and content before reading the full dataset.',
    parameters: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'The dataset ID from list_datasets',
        },
      },
      required: ['dataset_id'],
    },
  },
}

export async function executeGetDatasetPreview(args: { dataset_id: string }): Promise<FunctionResult> {
  try {
    const meta = getDataset(args.dataset_id)

    if (!meta) {
      return {
        result: `Dataset ${args.dataset_id} not found`,
        success: false,
      }
    }

    // BLOCK: If dataset has DB, refuse and redirect to query tools
    const dbInfo = (meta as any).dbInfo
    if (dbInfo) {
      return {
        result: `❌ Dataset "${meta.name}" is DB-backed (${meta.stats.rowCount.toLocaleString()} rows). Use describe_dataset(dataset_id="${args.dataset_id}") instead to avoid token burn!`,
        success: false,
      }
    }

    const preview = getDatasetPreview(args.dataset_id)

    // Format preview as text table
    const headerLine = preview.headers.join(' | ')
    const separator = '-'.repeat(headerLine.length)
    const rowLines = preview.sampleRows.slice(0, 20).map((row) => row.join(' | '))

    const previewText = [
      `Dataset: "${meta.name}" (${meta.stats.rowCount} rows × ${meta.stats.colCount} cols)`,
      `Source: ${meta.source.type === 'sec-filing' ? `SEC Filing (${meta.source.secFiling?.ticker || meta.source.secFiling?.cik})` : 'Uploaded'}`,
      '',
      headerLine,
      separator,
      ...rowLines,
      '',
      `Showing ${Math.min(20, preview.sampleRows.length)} of ${meta.stats.rowCount} rows`,
    ].join('\n')

    return {
      result: previewText,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error getting dataset preview: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 3: read_dataset_chunk
 * Read a chunk of dataset rows
 */
export const readDatasetChunkDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'read_dataset_chunk',
    description:
      'Read a chunk of rows from a dataset. Returns CSV text with headers. Use cursor=0 to start, then use nextCursor from the response to read subsequent chunks. Do NOT read the entire dataset unless necessary.',
    parameters: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'The dataset ID',
        },
        cursor: {
          type: 'number',
          description: 'Cursor position (0 to start, or nextCursor from previous response)',
          default: 0,
        },
      },
      required: ['dataset_id'],
    },
  },
}

export async function executeReadDatasetChunk(args: {
  dataset_id: string
  cursor?: number
}): Promise<FunctionResult> {
  try {
    const meta = getDataset(args.dataset_id)

    if (!meta) {
      return {
        result: `Dataset ${args.dataset_id} not found`,
        success: false,
      }
    }

    // BLOCK: If dataset has DB, refuse and redirect to query tools
    const dbInfo = (meta as any).dbInfo
    if (dbInfo) {
      return {
        result: `❌ Dataset "${meta.name}" is DB-backed (${meta.stats.rowCount.toLocaleString()} rows). Reading chunks will cause token overflow!\n\nInstead, use query tools:\n1. describe_dataset(dataset_id="${args.dataset_id}")\n2. search_catalog(dataset_id="${args.dataset_id}", query="your search term")\n3. get_series(...) to fetch specific data\n4. query_sql(...) for custom queries`,
        success: false,
      }
    }

    const cursor = args.cursor || 0
    const chunk = readDatasetChunk(args.dataset_id, { start: cursor })

    const statusLine = chunk.nextCursor
      ? `Chunk from row ${cursor}. Use cursor=${chunk.nextCursor} to continue.`
      : `Final chunk. All ${meta.stats.rowCount} rows read.`

    return {
      result: `${statusLine}\n\nData:\n${chunk.contentCsvText}`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error reading dataset chunk: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Tool 4: import_dataset_to_sheet
 * Import a dataset to a new sheet tab in the current Google Sheet
 */
export const importDatasetToSheetDefinition: FunctionDefinition = {
  type: 'function',
  function: {
    name: 'import_dataset_to_sheet',
    description:
      'Import a dataset to a new sheet tab in the current Google Sheet. Creates a new sheet with the dataset name, writes all data, and applies formatting (bold header, freeze row 1, filter).',
    parameters: {
      type: 'object',
      properties: {
        dataset_id: {
          type: 'string',
          description: 'The dataset ID to import',
        },
        sheet_name: {
          type: 'string',
          description: 'Name for the new sheet tab (will be created). Should be unique and descriptive.',
        },
      },
      required: ['dataset_id', 'sheet_name'],
    },
  },
}

export async function executeImportDatasetToSheet(
  args: { dataset_id: string; sheet_name: string },
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
      return {
        result: `Dataset ${args.dataset_id} not found`,
        success: false,
      }
    }

    // BLOCK: If dataset has DB, refuse and redirect to export_to_sheet
    const dbInfo = (meta as any).dbInfo
    if (dbInfo) {
      return {
        result: `❌ Dataset "${meta.name}" is DB-backed (${meta.stats.rowCount.toLocaleString()} rows). Importing the full dataset will cause token overflow and take forever!\n\nInstead, use:\n• export_to_sheet(dataset_id="${args.dataset_id}", mode="finance_summary_to_sheet", sheet_name="${args.sheet_name}") for curated financial metrics\n• Or query_sql(...) + export_to_sheet(..., mode="custom_query_to_sheet") for custom data`,
        success: false,
      }
    }

    const dataPath = getDatasetPath(args.dataset_id)
    const { rows } = parseFile(dataPath)

    if (rows.length === 0) {
      return {
        result: 'Dataset is empty',
        success: false,
      }
    }

    // Calculate dimensions
    const colCount = Math.max(...rows.map((r) => r.length))
    const rowCount = rows.length

    // Create new sheet with enough rows and columns
    await addSheet(spreadsheetId, args.sheet_name, {
      rowCount: Math.max(rowCount, 1000), // At least 1000 rows
      columnCount: Math.max(colCount, 26), // At least 26 columns (A-Z)
    })

    // Write data in batches (5,000 rows at a time)
    const BATCH_SIZE = 5000
    const endCol = indexToColLetter(colCount - 1)

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      // Pad rows to consistent column count
      const padded = batch.map((r) => {
        const row = [...r]
        while (row.length < colCount) row.push('')
        return row
      })
      const startRow = i + 1
      const endRow = i + padded.length
      const range = `${args.sheet_name}!A${startRow}:${endCol}${endRow}`
      await writeRange(spreadsheetId, range, padded)
    }

    // Format: bold header, freeze row 1, set filter
    if (rows.length > 0) {
      const headerRange = `${args.sheet_name}!A1:${endCol}1`
      const dataRange = `${args.sheet_name}!A1:${endCol}${rows.length}`

      try {
        await formatRange(spreadsheetId, headerRange, { bold: true, columnWidth: 160 })
      } catch {
        /* non-critical */
      }

      try {
        await freezeRowsCols(spreadsheetId, args.sheet_name, 1, 0)
      } catch {
        /* non-critical */
      }

      try {
        await setBasicFilter(spreadsheetId, dataRange)
      } catch {
        /* non-critical */
      }
    }

    return {
      result: `Imported dataset "${meta.name}" to sheet "${args.sheet_name}" (${rows.length} rows × ${colCount} cols)`,
      success: true,
    }
  } catch (err: any) {
    return {
      result: `Error importing dataset: ${err.message}`,
      success: false,
    }
  }
}

/**
 * Get all dataset tool definitions
 * NOTE: list_datasets is provided by queryTools.ts (more comprehensive)
 */
export function getDatasetToolDefinitions(): FunctionDefinition[] {
  return [
    getDatasetPreviewDefinition,
    readDatasetChunkDefinition,
    importDatasetToSheetDefinition,
  ]
}

/**
 * Execute a dataset tool by name
 */
export async function executeDatasetTool(
  toolName: string,
  args: any,
  getCurrentSpreadsheetId: () => string | undefined
): Promise<FunctionResult> {
  switch (toolName) {
    case 'get_dataset_preview':
      return executeGetDatasetPreview(args)
    case 'read_dataset_chunk':
      return executeReadDatasetChunk(args)
    case 'import_dataset_to_sheet':
      return executeImportDatasetToSheet(args, getCurrentSpreadsheetId)
    default:
      return {
        result: `Unknown dataset tool: ${toolName}`,
        success: false,
      }
  }
}
