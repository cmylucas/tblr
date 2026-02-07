import { z } from 'zod'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import {
  listSheets,
  getSpreadsheetInfo,
  readRange,
  writeRange,
  clearRange,
  addSheet,
  renameSheet,
  reorderSheets,
  formatRange,
  insertDimension,
  deleteDimension,
  sortRangeApi,
  duplicateSheet,
  addConditionalFormatRule,
  setDataValidation,
  setBasicFilter,
  clearBasicFilter,
  addNamedRangeApi,
  deleteNamedRangeApi,
  mergeCellsApi,
  unmergeCellsApi,
  freezeRowsCols,
  addPivotTableRaw,
  addChartRaw,
  colLetterToIndex,
  indexToColLetter,
  a1ToGridRange,
  type FormatSpec,
} from '../sheets/sheetsClient'
import { isSignedIn } from '../auth/googleAuth'

// ════════════════════════════════════════════════════════════════
// Zod schemas — tools 1–10 (original)
// ════════════════════════════════════════════════════════════════

const ListSheetsArgs = z.object({})
const GetSpreadsheetInfoArgs = z.object({})

const GetSheetPreviewArgs = z.object({
  sheetName: z.string().min(1),
  maxRows: z.number().int().min(1).max(100).optional().default(20),
  maxCols: z.number().int().min(1).max(26).optional().default(20),
})

const ReadRangeArgs = z.object({ a1Range: z.string().min(1) })

const WriteRangeArgs = z.object({
  a1Range: z.string().min(1),
  values: z.array(z.array(z.string())).min(1),
  inputMode: z.enum(['USER_ENTERED', 'RAW']).optional().default('USER_ENTERED'),
})

const ClearRangeArgs = z.object({ a1Range: z.string().min(1) })
const AddSheetArgs = z.object({ name: z.string().min(1).max(100) })

const RenameSheetArgs = z.object({
  oldName: z.string().min(1),
  newName: z.string().min(1).max(100),
})

const ReorderSheetsArgs = z.object({ order: z.array(z.string().min(1)).min(1) })

const FormatRangeArgs = z.object({
  a1Range: z.string().min(1),
  bold: z.boolean().optional(),
  numberFormat: z.enum(['CURRENCY', 'PERCENT', 'DATE', 'NUMBER']).optional(),
  columnWidth: z.number().int().min(10).max(1000).optional(),
})

// ════════════════════════════════════════════════════════════════
// Zod schemas — tools 11–20 (batch 2)
// ════════════════════════════════════════════════════════════════

const DetectTableArgs = z.object({
  sheetName: z.string().min(1),
  headerSearchRows: z.number().int().min(1).max(100).optional().default(10),
  maxScanRows: z.number().int().min(1).max(5000).optional().default(2000),
  maxScanCols: z.number().int().min(1).max(50).optional().default(50),
})

const FindLastUsedCellArgs = z.object({
  sheetName: z.string().min(1),
  maxRows: z.number().int().min(1).max(10000).optional().default(5000),
  maxCols: z.number().int().min(1).max(50).optional().default(50),
})

const SearchCellsArgs = z.object({
  query: z.string().min(1),
  sheetName: z.string().optional(),
  matchMode: z.enum(['contains', 'exact']).optional().default('contains'),
  limit: z.number().int().min(1).max(200).optional().default(50),
})

const InsertRowsArgs = z.object({
  sheetName: z.string().min(1),
  startIndex: z.number().int().min(1),
  numRows: z.number().int().min(1).max(2000),
})

const DeleteRowsArgs = z.object({
  sheetName: z.string().min(1),
  startIndex: z.number().int().min(1),
  numRows: z.number().int().min(1).max(2000),
})

const InsertColumnsArgs = z.object({
  sheetName: z.string().min(1),
  startIndex: z.number().int().min(1),
  numCols: z.number().int().min(1).max(200),
})

const DeleteColumnsArgs = z.object({
  sheetName: z.string().min(1),
  startIndex: z.number().int().min(1),
  numCols: z.number().int().min(1).max(200),
})

const SortRangeArgs = z.object({
  rangeA1: z.string().min(1),
  sortSpecs: z.array(z.object({
    column: z.union([z.string(), z.number()]),
    order: z.enum(['ASC', 'DESC']),
  })).min(1),
  hasHeader: z.boolean().optional().default(true),
})

const ReplaceTextArgs = z.object({
  a1Range: z.string().min(1),
  find: z.string().min(1),
  replace: z.string(),
  matchCase: z.boolean().optional().default(false),
  matchEntireCell: z.boolean().optional().default(false),
})

const DuplicateSheetArgs = z.object({
  sheetName: z.string().min(1),
  newName: z.string().min(1).max(100),
})

// ════════════════════════════════════════════════════════════════
// Zod schemas — tools 21–31 (batch 3: advanced)
// ════════════════════════════════════════════════════════════════

const AddPivotTableArgs = z.object({
  sourceRange: z.string().min(1),
  targetSheetName: z.string().min(1),
  targetCell: z.string().min(1).optional().default('A1'),
  rows: z.array(z.string()).min(1),
  columns: z.array(z.string()).optional().default([]),
  values: z.array(z.object({
    sourceColumn: z.string(),
    summarizeFunction: z.enum(['SUM', 'COUNT', 'AVERAGE', 'MAX', 'MIN', 'COUNTA']),
  })).min(1),
})

const AddConditionalFormatArgs = z.object({
  a1Range: z.string().min(1),
  ruleType: z.enum([
    'CUSTOM_FORMULA', 'NUMBER_GREATER', 'NUMBER_LESS', 'NUMBER_BETWEEN',
    'TEXT_CONTAINS', 'TEXT_NOT_CONTAINS', 'CELL_NOT_EMPTY', 'CELL_EMPTY',
  ]),
  values: z.array(z.string()).optional().default([]),
  format: z.object({
    bold: z.boolean().optional(),
    bgColor: z.string().optional(),
    textColor: z.string().optional(),
  }),
})

const SetDataValidationArgs = z.object({
  a1Range: z.string().min(1),
  validationType: z.enum([
    'ONE_OF_LIST', 'ONE_OF_RANGE', 'NUMBER_BETWEEN', 'NUMBER_GREATER',
    'NUMBER_LESS', 'CUSTOM_FORMULA',
  ]),
  values: z.array(z.string()).min(1),
  strict: z.boolean().optional().default(true),
  inputMessage: z.string().optional(),
})

const SetBasicFilterArgs = z.object({ a1Range: z.string().min(1) })
const ClearBasicFilterArgs = z.object({ sheetName: z.string().min(1) })

const AddNamedRangeArgs = z.object({
  name: z.string().min(1).max(100),
  a1Range: z.string().min(1),
})

const DeleteNamedRangeArgs = z.object({ name: z.string().min(1) })

const MergeCellsArgs = z.object({
  a1Range: z.string().min(1),
  mergeType: z.enum(['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS']).optional().default('MERGE_ALL'),
})

const UnmergeCellsArgs = z.object({ a1Range: z.string().min(1) })

const FreezeRowsColsArgs = z.object({
  sheetName: z.string().min(1),
  frozenRowCount: z.number().int().min(0).max(100).optional(),
  frozenColumnCount: z.number().int().min(0).max(50).optional(),
})

const AddChartArgs = z.object({
  dataRange: z.string().min(1),
  chartType: z.enum(['BAR', 'LINE', 'PIE', 'COLUMN', 'AREA', 'SCATTER']),
  title: z.string().optional(),
  anchorCell: z.string().optional(),
})

// ════════════════════════════════════════════════════════════════
// Tool definitions for OpenAI — all 31 tools
// ════════════════════════════════════════════════════════════════

export const toolDefinitions: ChatCompletionTool[] = [
  // ── 1–10: core ──
  {
    type: 'function',
    function: {
      name: 'list_sheets',
      description: 'List all sheet tabs in the attached spreadsheet with their IDs.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spreadsheet_info',
      description: 'Get metadata about the attached spreadsheet: title, locale, timezone, and all sheet properties.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sheet_preview',
      description: 'Get a preview of a sheet: header row + sample rows and basic stats (total rows/cols).',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Name of the sheet tab' },
          maxRows: { type: 'number', description: 'Max rows to return (default 20, max 100)' },
          maxCols: { type: 'number', description: 'Max columns to return (default 20, max 26)' },
        },
        required: ['sheetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_range',
      description: 'Read cell values from the attached spreadsheet. Use A1 notation like "Sheet1!A1:D10".',
      parameters: {
        type: 'object',
        properties: { a1Range: { type: 'string', description: 'A1 range, e.g. "Sheet1!A1:D20"' } },
        required: ['a1Range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_range',
      description: 'Write a 2D array of values to the attached spreadsheet. Uses USER_ENTERED mode by default so formulas work.',
      parameters: {
        type: 'object',
        properties: {
          a1Range: { type: 'string', description: 'Target A1 range, e.g. "Sheet1!A1:D1"' },
          values: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: '2D array of string values to write' },
          inputMode: { type: 'string', enum: ['USER_ENTERED', 'RAW'], description: 'Input mode (default USER_ENTERED)' },
        },
        required: ['a1Range', 'values'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_range',
      description: 'Clear all values in a range (keeps formatting).',
      parameters: { type: 'object', properties: { a1Range: { type: 'string', description: 'A1 range to clear' } }, required: ['a1Range'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_sheet',
      description: 'Add a new sheet tab to the spreadsheet.',
      parameters: { type: 'object', properties: { name: { type: 'string', description: 'Name for the new sheet' } }, required: ['name'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rename_sheet',
      description: 'Rename an existing sheet tab.',
      parameters: {
        type: 'object',
        properties: {
          oldName: { type: 'string', description: 'Current name of the sheet' },
          newName: { type: 'string', description: 'New name for the sheet' },
        },
        required: ['oldName', 'newName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reorder_sheets',
      description: 'Reorder sheet tabs. Provide the complete list of sheet names in desired order.',
      parameters: {
        type: 'object',
        properties: { order: { type: 'array', items: { type: 'string' }, description: 'Sheet names in desired order' } },
        required: ['order'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'format_range',
      description: 'Apply formatting to a range: bold, number format (CURRENCY, PERCENT, DATE, NUMBER), or column width.',
      parameters: {
        type: 'object',
        properties: {
          a1Range: { type: 'string', description: 'A1 range to format' },
          bold: { type: 'boolean', description: 'Set bold' },
          numberFormat: { type: 'string', enum: ['CURRENCY', 'PERCENT', 'DATE', 'NUMBER'], description: 'Number format' },
          columnWidth: { type: 'number', description: 'Column width in pixels' },
        },
        required: ['a1Range'],
      },
    },
  },

  // ── 11–20: analyst workflows ──
  {
    type: 'function',
    function: {
      name: 'detect_table',
      description: 'Detect the main data table in a sheet: finds the header row, data extent, column types. Returns headerRowIndex (1-based), dataRangeA1, numRows, numCols, headers, and columnTypeGuesses.',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Sheet tab name to scan' },
          headerSearchRows: { type: 'number', description: 'Rows to scan for header (default 10)' },
          maxScanRows: { type: 'number', description: 'Max data rows to scan below header (default 2000)' },
          maxScanCols: { type: 'number', description: 'Max columns to scan (default 50)' },
        },
        required: ['sheetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_last_used_cell',
      description: 'Find the last non-empty row and column in a sheet. Returns lastRow, lastCol (1-based) and usedRangeA1.',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Sheet tab name' },
          maxRows: { type: 'number', description: 'Max rows to scan (default 5000)' },
          maxCols: { type: 'number', description: 'Max columns to scan (default 50)' },
        },
        required: ['sheetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_cells',
      description: 'Search for a text string across cells. Returns matches with sheet name, A1 address, and value snippet.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for' },
          sheetName: { type: 'string', description: 'Limit search to this sheet (optional)' },
          matchMode: { type: 'string', enum: ['contains', 'exact'], description: 'Match mode (default "contains")' },
          limit: { type: 'number', description: 'Max matches to return (default 50)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'insert_rows',
      description: 'Insert empty rows into a sheet at a given position (1-based). Existing rows shift down.',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Sheet tab name' },
          startIndex: { type: 'number', description: 'Row number to insert before (1-based)' },
          numRows: { type: 'number', description: 'Number of rows to insert' },
        },
        required: ['sheetName', 'startIndex', 'numRows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_rows',
      description: 'Delete rows from a sheet starting at a given position (1-based).',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Sheet tab name' },
          startIndex: { type: 'number', description: 'Row number to start deleting (1-based)' },
          numRows: { type: 'number', description: 'Number of rows to delete' },
        },
        required: ['sheetName', 'startIndex', 'numRows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'insert_columns',
      description: 'Insert empty columns into a sheet at a given position (1-based). Existing columns shift right.',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Sheet tab name' },
          startIndex: { type: 'number', description: 'Column number to insert before (1-based)' },
          numCols: { type: 'number', description: 'Number of columns to insert' },
        },
        required: ['sheetName', 'startIndex', 'numCols'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_columns',
      description: 'Delete columns from a sheet starting at a given position (1-based).',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Sheet tab name' },
          startIndex: { type: 'number', description: 'Column number to start deleting (1-based)' },
          numCols: { type: 'number', description: 'Number of columns to delete' },
        },
        required: ['sheetName', 'startIndex', 'numCols'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sort_range',
      description: 'Sort a range by one or more columns. Column can be a header name (string) or 1-based index (number). Order is "ASC" or "DESC".',
      parameters: {
        type: 'object',
        properties: {
          rangeA1: { type: 'string', description: 'A1 range to sort, e.g. "Sheet1!A1:G200"' },
          sortSpecs: { type: 'array', items: { type: 'object', properties: { column: { description: 'Column header name or 1-based index' }, order: { type: 'string', enum: ['ASC', 'DESC'] } }, required: ['column', 'order'] } },
          hasHeader: { type: 'boolean', description: 'First row is a header (default true)' },
        },
        required: ['rangeA1', 'sortSpecs'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_text',
      description: 'Find and replace text within a range. Reads cells, transforms in-memory, writes back.',
      parameters: {
        type: 'object',
        properties: {
          a1Range: { type: 'string', description: 'A1 range to search within' },
          find: { type: 'string', description: 'Text to find' },
          replace: { type: 'string', description: 'Replacement text' },
          matchCase: { type: 'boolean', description: 'Case-sensitive (default false)' },
          matchEntireCell: { type: 'boolean', description: 'Match entire cell (default false)' },
        },
        required: ['a1Range', 'find', 'replace'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'duplicate_sheet',
      description: 'Duplicate an existing sheet tab with a new name.',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Name of the sheet to duplicate' },
          newName: { type: 'string', description: 'Name for the copy' },
        },
        required: ['sheetName', 'newName'],
      },
    },
  },

  // ── 21–31: advanced features ──
  {
    type: 'function',
    function: {
      name: 'add_pivot_table',
      description: 'Create a pivot table from source data. Specify row/column grouping fields by header name and value aggregation functions.',
      parameters: {
        type: 'object',
        properties: {
          sourceRange: { type: 'string', description: 'Source data A1 range including headers, e.g. "Data!A1:F500"' },
          targetSheetName: { type: 'string', description: 'Sheet where pivot table will be placed' },
          targetCell: { type: 'string', description: 'Top-left cell for pivot table (default "A1")' },
          rows: { type: 'array', items: { type: 'string' }, description: 'Column header names to use as row groups' },
          columns: { type: 'array', items: { type: 'string' }, description: 'Column header names for column groups (optional)' },
          values: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sourceColumn: { type: 'string', description: 'Header name of the column to aggregate' },
                summarizeFunction: { type: 'string', enum: ['SUM', 'COUNT', 'AVERAGE', 'MAX', 'MIN', 'COUNTA'] },
              },
              required: ['sourceColumn', 'summarizeFunction'],
            },
            description: 'Values to aggregate',
          },
        },
        required: ['sourceRange', 'targetSheetName', 'rows', 'values'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_conditional_format',
      description: 'Add a conditional formatting rule. Supports formula, number comparison, text matching, and blank/non-blank rules. Colors are hex strings like "#FF0000".',
      parameters: {
        type: 'object',
        properties: {
          a1Range: { type: 'string', description: 'A1 range to apply rule to' },
          ruleType: { type: 'string', enum: ['CUSTOM_FORMULA', 'NUMBER_GREATER', 'NUMBER_LESS', 'NUMBER_BETWEEN', 'TEXT_CONTAINS', 'TEXT_NOT_CONTAINS', 'CELL_NOT_EMPTY', 'CELL_EMPTY'] },
          values: { type: 'array', items: { type: 'string' }, description: 'Condition values (formula string, threshold numbers, search text). Empty for CELL_NOT_EMPTY/CELL_EMPTY.' },
          format: {
            type: 'object',
            properties: {
              bold: { type: 'boolean', description: 'Make text bold' },
              bgColor: { type: 'string', description: 'Background color hex, e.g. "#FFCCCC"' },
              textColor: { type: 'string', description: 'Text color hex, e.g. "#CC0000"' },
            },
          },
        },
        required: ['a1Range', 'ruleType', 'format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_data_validation',
      description: 'Set data validation on a range: dropdown lists, number constraints, or custom formulas.',
      parameters: {
        type: 'object',
        properties: {
          a1Range: { type: 'string', description: 'A1 range to validate' },
          validationType: { type: 'string', enum: ['ONE_OF_LIST', 'ONE_OF_RANGE', 'NUMBER_BETWEEN', 'NUMBER_GREATER', 'NUMBER_LESS', 'CUSTOM_FORMULA'] },
          values: { type: 'array', items: { type: 'string' }, description: 'For ONE_OF_LIST: list items. ONE_OF_RANGE: single range string. NUMBER_*: threshold(s). CUSTOM_FORMULA: formula.' },
          strict: { type: 'boolean', description: 'Reject invalid input (default true)' },
          inputMessage: { type: 'string', description: 'Help message shown on cell focus' },
        },
        required: ['a1Range', 'validationType', 'values'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_basic_filter',
      description: 'Add auto-filter dropdowns to a range (like clicking Data > Create a filter in Sheets).',
      parameters: {
        type: 'object',
        properties: { a1Range: { type: 'string', description: 'A1 range to filter, e.g. "Sheet1!A1:G200"' } },
        required: ['a1Range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_basic_filter',
      description: 'Remove the auto-filter from a sheet.',
      parameters: {
        type: 'object',
        properties: { sheetName: { type: 'string', description: 'Sheet tab name' } },
        required: ['sheetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_named_range',
      description: 'Create a named range (e.g., "TotalRevenue" pointing to "Summary!B5").',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name for the range (no spaces)' },
          a1Range: { type: 'string', description: 'A1 range it refers to' },
        },
        required: ['name', 'a1Range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_named_range',
      description: 'Delete a named range by name.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Name of the named range to delete' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'merge_cells',
      description: 'Merge cells in a range. Merge types: MERGE_ALL (single block), MERGE_COLUMNS (merge within each column), MERGE_ROWS (merge within each row).',
      parameters: {
        type: 'object',
        properties: {
          a1Range: { type: 'string', description: 'A1 range to merge' },
          mergeType: { type: 'string', enum: ['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS'], description: 'Merge strategy (default MERGE_ALL)' },
        },
        required: ['a1Range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unmerge_cells',
      description: 'Unmerge previously merged cells in a range.',
      parameters: {
        type: 'object',
        properties: { a1Range: { type: 'string', description: 'A1 range to unmerge' } },
        required: ['a1Range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'freeze_rows_cols',
      description: 'Freeze (pin) rows and/or columns so they stay visible while scrolling. Set to 0 to unfreeze.',
      parameters: {
        type: 'object',
        properties: {
          sheetName: { type: 'string', description: 'Sheet tab name' },
          frozenRowCount: { type: 'number', description: 'Number of rows to freeze from top (0 = none)' },
          frozenColumnCount: { type: 'number', description: 'Number of columns to freeze from left (0 = none)' },
        },
        required: ['sheetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_chart',
      description: 'Create a chart from data. First column of dataRange is the domain (x-axis labels), remaining columns are series. Supports BAR, LINE, PIE, COLUMN, AREA, SCATTER.',
      parameters: {
        type: 'object',
        properties: {
          dataRange: { type: 'string', description: 'A1 range with headers, e.g. "Sheet1!A1:D20". First column = labels, rest = data series.' },
          chartType: { type: 'string', enum: ['BAR', 'LINE', 'PIE', 'COLUMN', 'AREA', 'SCATTER'] },
          title: { type: 'string', description: 'Chart title (optional)' },
          anchorCell: { type: 'string', description: 'Where to place the chart, e.g. "F1" (optional, defaults to right of data)' },
        },
        required: ['dataRange', 'chartType'],
      },
    },
  },
]

// ════════════════════════════════════════════════════════════════
// Guardrails
// ════════════════════════════════════════════════════════════════

const MAX_WRITE_CELLS = 20_000
const MAX_SCAN_CELLS = 50_000

// ════════════════════════════════════════════════════════════════
// Tool dispatcher
// ════════════════════════════════════════════════════════════════

export async function executeTool(
  name: string,
  rawArgs: string,
  spreadsheetId: string | undefined,
  sheetNames: string[]
): Promise<{ result: string; success: boolean }> {
  if (!isSignedIn()) {
    return { result: 'Error: Not authenticated. Please sign in with Google first.', success: false }
  }
  if (!spreadsheetId) {
    return { result: 'Error: No sheet attached. Please attach a Google Sheet first.', success: false }
  }

  let parsedArgs: unknown
  try {
    parsedArgs = JSON.parse(rawArgs)
  } catch {
    return { result: `Error: Invalid JSON args: ${rawArgs}`, success: false }
  }

  try {
    switch (name) {
      // ── 1–10: core ──

      case 'list_sheets': {
        ListSheetsArgs.parse(parsedArgs)
        const sheets = await listSheets(spreadsheetId)
        return { result: JSON.stringify(sheets), success: true }
      }
      case 'get_spreadsheet_info': {
        GetSpreadsheetInfoArgs.parse(parsedArgs)
        const info = await getSpreadsheetInfo(spreadsheetId)
        return { result: JSON.stringify(info), success: true }
      }
      case 'get_sheet_preview': {
        const args = GetSheetPreviewArgs.parse(parsedArgs)
        const colLetter = String.fromCharCode(64 + args.maxCols)
        const range = `${args.sheetName}!A1:${colLetter}${args.maxRows}`
        const values = await readRange(spreadsheetId, range)
        const info = await getSpreadsheetInfo(spreadsheetId)
        const sheetInfo = info.sheets.find((s) => s.title === args.sheetName)
        return {
          result: JSON.stringify({ sheetName: args.sheetName, totalRows: sheetInfo?.rowCount ?? 'unknown', totalColumns: sheetInfo?.columnCount ?? 'unknown', previewRows: values.length, data: values }),
          success: true,
        }
      }
      case 'read_range': {
        const args = ReadRangeArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        const values = await readRange(spreadsheetId, range)
        return { result: JSON.stringify({ range, rows: values.length, cols: values[0]?.length ?? 0, data: values }), success: true }
      }
      case 'write_range': {
        const args = WriteRangeArgs.parse(parsedArgs)
        const cellCount = args.values.reduce((sum, row) => sum + row.length, 0)
        if (cellCount > MAX_WRITE_CELLS) return { result: `Error: Write would affect ${cellCount} cells, exceeding limit of ${MAX_WRITE_CELLS}.`, success: false }
        const range = ensureScope(args.a1Range, sheetNames)
        const res = await writeRange(spreadsheetId, range, args.values, args.inputMode)
        return { result: JSON.stringify({ range, ...res }), success: true }
      }
      case 'clear_range': {
        const args = ClearRangeArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        const res = await clearRange(spreadsheetId, range)
        return { result: JSON.stringify(res), success: true }
      }
      case 'add_sheet': {
        const args = AddSheetArgs.parse(parsedArgs)
        const res = await addSheet(spreadsheetId, args.name)
        return { result: JSON.stringify({ name: args.name, sheetId: res.sheetId }), success: true }
      }
      case 'rename_sheet': {
        const args = RenameSheetArgs.parse(parsedArgs)
        await renameSheet(spreadsheetId, args.oldName, args.newName)
        return { result: JSON.stringify({ oldName: args.oldName, newName: args.newName }), success: true }
      }
      case 'reorder_sheets': {
        const args = ReorderSheetsArgs.parse(parsedArgs)
        await reorderSheets(spreadsheetId, args.order)
        return { result: JSON.stringify({ order: args.order }), success: true }
      }
      case 'format_range': {
        const args = FormatRangeArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        const spec: FormatSpec = {}
        if (args.bold !== undefined) spec.bold = args.bold
        if (args.numberFormat) spec.numberFormat = args.numberFormat
        if (args.columnWidth) spec.columnWidth = args.columnWidth
        await formatRange(spreadsheetId, range, spec)
        return { result: JSON.stringify({ range, format: spec }), success: true }
      }

      // ── 11–20: analyst workflows ──

      case 'detect_table':
        return await executeDetectTable(spreadsheetId, DetectTableArgs.parse(parsedArgs))
      case 'find_last_used_cell':
        return await executeFindLastUsedCell(spreadsheetId, FindLastUsedCellArgs.parse(parsedArgs))
      case 'search_cells':
        return await executeSearchCells(spreadsheetId, SearchCellsArgs.parse(parsedArgs), sheetNames)
      case 'insert_rows': {
        const args = InsertRowsArgs.parse(parsedArgs)
        await insertDimension(spreadsheetId, args.sheetName, 'ROWS', args.startIndex - 1, args.numRows)
        return { result: JSON.stringify({ sheetName: args.sheetName, inserted: args.numRows, atRow: args.startIndex }), success: true }
      }
      case 'delete_rows': {
        const args = DeleteRowsArgs.parse(parsedArgs)
        await deleteDimension(spreadsheetId, args.sheetName, 'ROWS', args.startIndex - 1, args.numRows)
        return { result: JSON.stringify({ sheetName: args.sheetName, deleted: args.numRows, fromRow: args.startIndex }), success: true }
      }
      case 'insert_columns': {
        const args = InsertColumnsArgs.parse(parsedArgs)
        await insertDimension(spreadsheetId, args.sheetName, 'COLUMNS', args.startIndex - 1, args.numCols)
        return { result: JSON.stringify({ sheetName: args.sheetName, inserted: args.numCols, atCol: args.startIndex }), success: true }
      }
      case 'delete_columns': {
        const args = DeleteColumnsArgs.parse(parsedArgs)
        await deleteDimension(spreadsheetId, args.sheetName, 'COLUMNS', args.startIndex - 1, args.numCols)
        return { result: JSON.stringify({ sheetName: args.sheetName, deleted: args.numCols, fromCol: args.startIndex }), success: true }
      }
      case 'sort_range':
        return await executeSortRange(spreadsheetId, SortRangeArgs.parse(parsedArgs), sheetNames)
      case 'replace_text':
        return await executeReplaceText(spreadsheetId, ReplaceTextArgs.parse(parsedArgs), sheetNames)
      case 'duplicate_sheet': {
        const args = DuplicateSheetArgs.parse(parsedArgs)
        const res = await duplicateSheet(spreadsheetId, args.sheetName, args.newName)
        return { result: JSON.stringify(res), success: true }
      }

      // ── 21–31: advanced features ──

      case 'add_pivot_table':
        return await executeAddPivotTable(spreadsheetId, AddPivotTableArgs.parse(parsedArgs), sheetNames)
      case 'add_conditional_format': {
        const args = AddConditionalFormatArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        const condType = args.ruleType === 'CELL_NOT_EMPTY' ? 'NOT_BLANK' : args.ruleType === 'CELL_EMPTY' ? 'BLANK' : args.ruleType
        await addConditionalFormatRule(spreadsheetId, range, condType, args.values, args.format)
        return { result: JSON.stringify({ range, ruleType: args.ruleType, format: args.format }), success: true }
      }
      case 'set_data_validation': {
        const args = SetDataValidationArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        await setDataValidation(spreadsheetId, range, args.validationType, args.values, args.strict, args.inputMessage)
        return { result: JSON.stringify({ range, validationType: args.validationType, strict: args.strict }), success: true }
      }
      case 'set_basic_filter': {
        const args = SetBasicFilterArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        await setBasicFilter(spreadsheetId, range)
        return { result: JSON.stringify({ range, filter: 'applied' }), success: true }
      }
      case 'clear_basic_filter': {
        const args = ClearBasicFilterArgs.parse(parsedArgs)
        await clearBasicFilter(spreadsheetId, args.sheetName)
        return { result: JSON.stringify({ sheetName: args.sheetName, filter: 'cleared' }), success: true }
      }
      case 'add_named_range': {
        const args = AddNamedRangeArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        const res = await addNamedRangeApi(spreadsheetId, args.name, range)
        return { result: JSON.stringify({ name: args.name, range, namedRangeId: res.namedRangeId }), success: true }
      }
      case 'delete_named_range': {
        const args = DeleteNamedRangeArgs.parse(parsedArgs)
        await deleteNamedRangeApi(spreadsheetId, args.name)
        return { result: JSON.stringify({ name: args.name, deleted: true }), success: true }
      }
      case 'merge_cells': {
        const args = MergeCellsArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        await mergeCellsApi(spreadsheetId, range, args.mergeType)
        return { result: JSON.stringify({ range, mergeType: args.mergeType }), success: true }
      }
      case 'unmerge_cells': {
        const args = UnmergeCellsArgs.parse(parsedArgs)
        const range = ensureScope(args.a1Range, sheetNames)
        await unmergeCellsApi(spreadsheetId, range)
        return { result: JSON.stringify({ range, unmerged: true }), success: true }
      }
      case 'freeze_rows_cols': {
        const args = FreezeRowsColsArgs.parse(parsedArgs)
        await freezeRowsCols(spreadsheetId, args.sheetName, args.frozenRowCount, args.frozenColumnCount)
        return { result: JSON.stringify({ sheetName: args.sheetName, frozenRows: args.frozenRowCount, frozenCols: args.frozenColumnCount }), success: true }
      }
      case 'add_chart':
        return await executeAddChart(spreadsheetId, AddChartArgs.parse(parsedArgs), sheetNames)

      default:
        return { result: `Error: Unknown tool "${name}"`, success: false }
    }
  } catch (err: any) {
    return { result: `Error: ${err.message}`, success: false }
  }
}

// ════════════════════════════════════════════════════════════════
// Complex tool implementations
// ════════════════════════════════════════════════════════════════

// ── detect_table ──

async function executeDetectTable(
  spreadsheetId: string,
  args: z.infer<typeof DetectTableArgs>
): Promise<{ result: string; success: boolean }> {
  const totalRows = args.headerSearchRows + args.maxScanRows
  const effectiveCols = Math.min(args.maxScanCols, Math.floor(MAX_SCAN_CELLS / totalRows))
  const effectiveRows = Math.min(totalRows, Math.floor(MAX_SCAN_CELLS / Math.max(effectiveCols, 1)))
  if (effectiveCols < 1 || effectiveRows < 2) return { result: 'Error: Scan window too large.', success: false }

  const endCol = indexToColLetter(effectiveCols - 1)
  const data = await readRange(spreadsheetId, `${args.sheetName}!A1:${endCol}${effectiveRows}`)
  if (data.length === 0) return { result: JSON.stringify({ error: 'Sheet appears empty.' }), success: false }

  let headerRowIdx = 0, maxNonEmpty = 0
  for (let r = 0; r < Math.min(args.headerSearchRows, data.length); r++) {
    const ne = (data[r] || []).filter((c) => c !== '' && c != null).length
    if (ne > maxNonEmpty && ne >= 2) { maxNonEmpty = ne; headerRowIdx = r }
  }
  if (maxNonEmpty < 2) return { result: JSON.stringify({ error: 'Could not detect a header row with at least 2 non-empty cells.' }), success: false }

  const headers = data[headerRowIdx] || []
  const usedCols = new Set<number>()
  for (let c = 0; c < headers.length; c++) if (headers[c]?.trim()) usedCols.add(c)

  let lastDataRow = headerRowIdx, consecutiveEmpty = 0
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r] || []
    if (row.some((c) => c !== '' && c != null)) {
      consecutiveEmpty = 0; lastDataRow = r
      for (let c = 0; c < row.length; c++) if (row[c]?.trim()) usedCols.add(c)
    } else { consecutiveEmpty++; if (consecutiveEmpty >= 20) break }
  }

  const numCols = usedCols.size > 0 ? Math.max(...usedCols) + 1 : 0
  const dateRe = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/, currencyRe = /^\$[\d,]+\.?\d*$/, percentRe = /^[\d.]+%$/, numberRe = /^-?[\d,]+\.?\d*$/
  const typeGuesses: Record<string, string> = {}
  for (let c = 0; c < numCols && c < headers.length; c++) {
    const hdr = headers[c]?.trim(); if (!hdr) continue
    const samples: string[] = []
    for (let r = headerRowIdx + 1; r <= lastDataRow && samples.length < 20; r++) { const v = data[r]?.[c]?.trim(); if (v) samples.push(v) }
    if (!samples.length) { typeGuesses[hdr] = 'text'; continue }
    const th = samples.length * 0.5
    if (samples.filter((s) => dateRe.test(s)).length >= th) typeGuesses[hdr] = 'date'
    else if (samples.filter((s) => currencyRe.test(s)).length >= th) typeGuesses[hdr] = 'currency'
    else if (samples.filter((s) => percentRe.test(s)).length >= th) typeGuesses[hdr] = 'percent'
    else if (samples.filter((s) => numberRe.test(s)).length >= th) typeGuesses[hdr] = 'number'
    else typeGuesses[hdr] = 'text'
  }

  const endColLetter = numCols > 0 ? indexToColLetter(numCols - 1) : 'A'
  return {
    result: JSON.stringify({
      headerRowIndex: headerRowIdx + 1, dataRangeA1: `${args.sheetName}!A${headerRowIdx + 1}:${endColLetter}${lastDataRow + 1}`,
      numRows: lastDataRow - headerRowIdx, numCols, headers: headers.slice(0, numCols).map((h) => h?.trim() || ''), columnTypeGuesses: typeGuesses,
    }),
    success: true,
  }
}

// ── find_last_used_cell ──

async function executeFindLastUsedCell(
  spreadsheetId: string,
  args: z.infer<typeof FindLastUsedCellArgs>
): Promise<{ result: string; success: boolean }> {
  const ec = Math.min(args.maxCols, Math.floor(MAX_SCAN_CELLS / args.maxRows))
  const er = Math.min(args.maxRows, Math.floor(MAX_SCAN_CELLS / Math.max(ec, 1)))
  if (ec < 1 || er < 1) return { result: 'Error: Scan window too large.', success: false }

  const data = await readRange(spreadsheetId, `${args.sheetName}!A1:${indexToColLetter(ec - 1)}${er}`)
  let lastRow = 0, lastCol = 0
  for (let r = 0; r < data.length; r++) for (let c = 0; c < (data[r]?.length ?? 0); c++) if (data[r][c] !== '' && data[r][c] != null) { if (r + 1 > lastRow) lastRow = r + 1; if (c + 1 > lastCol) lastCol = c + 1 }
  if (lastRow === 0) return { result: JSON.stringify({ lastRow: 0, lastCol: 0, usedRangeA1: null, message: 'Sheet is empty' }), success: true }
  return { result: JSON.stringify({ lastRow, lastCol, usedRangeA1: `${args.sheetName}!A1:${indexToColLetter(lastCol - 1)}${lastRow}` }), success: true }
}

// ── search_cells ──

async function executeSearchCells(
  spreadsheetId: string,
  args: z.infer<typeof SearchCellsArgs>,
  sheetNames: string[]
): Promise<{ result: string; success: boolean }> {
  const sheetsToSearch = args.sheetName ? [args.sheetName] : sheetNames
  if (!sheetsToSearch.length) return { result: 'Error: No sheets available to search.', success: false }
  const matches: Array<{ sheetName: string; a1: string; valueSnippet: string }> = []
  const scanCols = 50, scanRows = Math.min(5000, Math.floor(MAX_SCAN_CELLS / sheetsToSearch.length / scanCols))

  for (const sheet of sheetsToSearch) {
    if (matches.length >= args.limit) break
    let data: string[][]
    try { data = await readRange(spreadsheetId, `${sheet}!A1:${indexToColLetter(scanCols - 1)}${scanRows}`) } catch { continue }
    for (let r = 0; r < data.length && matches.length < args.limit; r++)
      for (let c = 0; c < (data[r]?.length ?? 0) && matches.length < args.limit; c++) {
        const cell = data[r][c]; if (cell == null || cell === '') continue
        const isMatch = args.matchMode === 'exact' ? cell === args.query : cell.toLowerCase().includes(args.query.toLowerCase())
        if (isMatch) matches.push({ sheetName: sheet, a1: `${sheet}!${indexToColLetter(c)}${r + 1}`, valueSnippet: cell.length > 80 ? cell.substring(0, 80) + '…' : cell })
      }
  }
  return { result: JSON.stringify({ query: args.query, matchCount: matches.length, matches }), success: true }
}

// ── sort_range ──

async function executeSortRange(
  spreadsheetId: string,
  args: z.infer<typeof SortRangeArgs>,
  sheetNames: string[]
): Promise<{ result: string; success: boolean }> {
  const rangeA1 = ensureScope(args.rangeA1, sheetNames)
  const sheetPart = rangeA1.includes('!') ? rangeA1.split('!') : [sheetNames[0] || '', rangeA1]
  const rangeMatch = sheetPart[1].match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i)
  if (!rangeMatch) return { result: `Error: Cannot parse range "${rangeA1}"`, success: false }
  const rangeStartCol = colLetterToIndex(rangeMatch[1])

  let headerRow: string[] | null = null
  if (args.sortSpecs.some((s) => typeof s.column === 'string')) {
    const hRange = `${sheetPart[0]}!${rangeMatch[1]}${rangeMatch[2]}:${rangeMatch[3] || rangeMatch[1]}${rangeMatch[2]}`
    headerRow = (await readRange(spreadsheetId, hRange))[0] || []
  }

  const resolvedSpecs = args.sortSpecs.map((s) => {
    let off: number
    if (typeof s.column === 'number') { off = s.column - 1 }
    else { if (!headerRow) throw new Error('Header row not loaded'); const i = headerRow.findIndex((h) => h?.trim().toLowerCase() === String(s.column).toLowerCase()); if (i === -1) throw new Error(`Column "${s.column}" not found in header`); off = i }
    return { dimensionIndex: rangeStartCol + off, sortOrder: (s.order === 'ASC' ? 'ASCENDING' : 'DESCENDING') as 'ASCENDING' | 'DESCENDING' }
  })

  let sortA1 = rangeA1
  if (args.hasHeader && rangeMatch[2]) {
    const ds = parseInt(rangeMatch[2], 10) + 1
    sortA1 = `${sheetPart[0]}!${rangeMatch[1]}${ds}${rangeMatch[3] && rangeMatch[4] ? `:${rangeMatch[3]}${rangeMatch[4]}` : ''}`
  }
  await sortRangeApi(spreadsheetId, sortA1, resolvedSpecs)
  return { result: JSON.stringify({ range: rangeA1, sortedRange: sortA1, sortSpecs: args.sortSpecs }), success: true }
}

// ── replace_text ──

async function executeReplaceText(
  spreadsheetId: string,
  args: z.infer<typeof ReplaceTextArgs>,
  sheetNames: string[]
): Promise<{ result: string; success: boolean }> {
  const range = ensureScope(args.a1Range, sheetNames)
  const data = await readRange(spreadsheetId, range)
  const totalCells = data.reduce((sum, row) => sum + row.length, 0)
  if (totalCells > MAX_SCAN_CELLS) return { result: `Error: Range contains ${totalCells} cells, exceeding limit of ${MAX_SCAN_CELLS}. Narrow your range.`, success: false }

  let replacements = 0
  const newData = data.map((row) => row.map((cell) => {
    if (args.matchEntireCell) {
      const match = args.matchCase ? cell === args.find : cell.toLowerCase() === args.find.toLowerCase()
      if (match) { replacements++; return args.replace }
      return cell
    } else {
      const escaped = args.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(escaped, args.matchCase ? 'g' : 'gi')
      const nc = cell.replace(re, args.replace)
      if (nc !== cell) replacements++
      return nc
    }
  }))
  if (replacements === 0) return { result: JSON.stringify({ range, replacements: 0, message: 'No matches found.' }), success: true }
  const wr = await writeRange(spreadsheetId, range, newData)
  return { result: JSON.stringify({ range, replacements, updatedCells: wr.updatedCells }), success: true }
}

// ── add_pivot_table ──

async function executeAddPivotTable(
  spreadsheetId: string,
  args: z.infer<typeof AddPivotTableArgs>,
  sheetNames: string[]
): Promise<{ result: string; success: boolean }> {
  const sourceRange = ensureScope(args.sourceRange, sheetNames)
  const info = await getSpreadsheetInfo(spreadsheetId)

  // Resolve source sheet and GridRange
  const sourceSheetName = sourceRange.includes('!') ? sourceRange.split('!')[0] : sheetNames[0]
  const sourceSheet = info.sheets.find((s) => s.title === sourceSheetName)
  if (!sourceSheet) throw new Error(`Source sheet "${sourceSheetName}" not found`)
  const sourceGridRange = a1ToGridRange(sourceRange, sourceSheet.sheetId)

  // Read header row to map column names → offsets
  const a1Part = sourceRange.includes('!') ? sourceRange.split('!')[1] : sourceRange
  const rm = a1Part.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i)
  if (!rm) throw new Error(`Cannot parse source range "${sourceRange}"`)
  const hRange = `${sourceSheetName}!${rm[1]}${rm[2]}:${rm[3] || rm[1]}${rm[2]}`
  const headers = (await readRange(spreadsheetId, hRange))[0] || []

  const nameToOffset = (name: string): number => {
    const idx = headers.findIndex((h) => h?.trim().toLowerCase() === name.toLowerCase())
    if (idx === -1) throw new Error(`Column "${name}" not found in headers: [${headers.join(', ')}]`)
    return idx
  }

  const pivotRows = args.rows.map(nameToOffset)
  const pivotCols = args.columns.map(nameToOffset)
  const pivotValues = args.values.map((v) => ({
    sourceColumnOffset: nameToOffset(v.sourceColumn),
    summarizeFunction: v.summarizeFunction,
  }))

  // Resolve target
  const targetSheet = info.sheets.find((s) => s.title === args.targetSheetName)
  if (!targetSheet) throw new Error(`Target sheet "${args.targetSheetName}" not found. Create it first with add_sheet.`)
  const cellMatch = args.targetCell.match(/^([A-Z]+)(\d+)$/i)
  const targetCol = cellMatch ? colLetterToIndex(cellMatch[1]) : 0
  const targetRow = cellMatch ? parseInt(cellMatch[2], 10) - 1 : 0

  await addPivotTableRaw(spreadsheetId, sourceGridRange, targetSheet.sheetId, targetRow, targetCol, pivotRows, pivotCols, pivotValues)

  return {
    result: JSON.stringify({ sourceRange, targetSheet: args.targetSheetName, targetCell: args.targetCell, rows: args.rows, columns: args.columns, values: args.values }),
    success: true,
  }
}

// ── add_chart ──

async function executeAddChart(
  spreadsheetId: string,
  args: z.infer<typeof AddChartArgs>,
  sheetNames: string[]
): Promise<{ result: string; success: boolean }> {
  const dataRange = ensureScope(args.dataRange, sheetNames)
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = dataRange.includes('!') ? dataRange.split('!')[0] : sheetNames[0]
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(dataRange, sheet.sheetId)

  // Domain = first column, Series = remaining columns
  const domainRange = {
    sheetId: sheet.sheetId,
    startRowIndex: gridRange.startRowIndex,
    endRowIndex: gridRange.endRowIndex,
    startColumnIndex: gridRange.startColumnIndex,
    endColumnIndex: gridRange.startColumnIndex! + 1,
  }
  const startSeriesCol = gridRange.startColumnIndex! + 1
  const endSeriesCol = gridRange.endColumnIndex!

  let spec: any

  if (args.chartType === 'PIE') {
    const seriesRange = {
      sheetId: sheet.sheetId,
      startRowIndex: gridRange.startRowIndex,
      endRowIndex: gridRange.endRowIndex,
      startColumnIndex: startSeriesCol,
      endColumnIndex: Math.min(startSeriesCol + 1, endSeriesCol),
    }
    spec = {
      title: args.title || '',
      pieChart: {
        domain: { sourceRange: { sources: [domainRange] } },
        series: { sourceRange: { sources: [seriesRange] } },
        legendPosition: 'RIGHT_LEGEND',
      },
    }
  } else {
    const series = []
    for (let c = startSeriesCol; c < endSeriesCol; c++) {
      series.push({
        series: {
          sourceRange: {
            sources: [{
              sheetId: sheet.sheetId,
              startRowIndex: gridRange.startRowIndex,
              endRowIndex: gridRange.endRowIndex,
              startColumnIndex: c,
              endColumnIndex: c + 1,
            }],
          },
        },
        targetAxis: 'LEFT_AXIS',
      })
    }
    spec = {
      title: args.title || '',
      basicChart: {
        chartType: args.chartType,
        domains: [{ domain: { sourceRange: { sources: [domainRange] } } }],
        series,
        headerCount: 1,
        legendPosition: 'BOTTOM_LEGEND',
      },
    }
  }

  // Anchor position
  let anchorRow = gridRange.startRowIndex ?? 0
  let anchorCol = (gridRange.endColumnIndex ?? 0) + 1
  if (args.anchorCell) {
    const cm = args.anchorCell.match(/^(?:(.+)!)?([A-Z]+)(\d+)$/i)
    if (cm) { anchorCol = colLetterToIndex(cm[2]); anchorRow = parseInt(cm[3], 10) - 1 }
  }

  const res = await addChartRaw(spreadsheetId, spec, sheet.sheetId, anchorRow, anchorCol)

  return {
    result: JSON.stringify({ chartId: res.chartId, chartType: args.chartType, dataRange, title: args.title || '' }),
    success: true,
  }
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function ensureScope(range: string, sheetNames: string[]): string {
  if (range.includes('!')) return range
  if (sheetNames.length > 0) {
    console.log(`[tools] Defaulting range "${range}" to sheet "${sheetNames[0]}"`)
    return `${sheetNames[0]}!${range}`
  }
  return range
}
