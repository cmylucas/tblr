import { google, sheets_v4 } from 'googleapis'
import { getOAuth2Client } from '../auth/googleAuth'

function getSheetsApi(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getOAuth2Client() })
}

// ── Column helpers (exported) ──

export function colLetterToIndex(col: string): number {
  let idx = 0
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.toUpperCase().charCodeAt(i) - 64)
  }
  return idx - 1 // 0-based: A=0, B=1, Z=25, AA=26
}

export function indexToColLetter(idx: number): string {
  let letter = ''
  let n = idx + 1
  while (n > 0) {
    n--
    letter = String.fromCharCode(65 + (n % 26)) + letter
    n = Math.floor(n / 26)
  }
  return letter
}

// ── Sheet-ID resolver (exported) ──

export async function getSheetIdByName(spreadsheetId: string, sheetName: string): Promise<number> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)
  return sheet.sheetId
}

// ── Metadata ──

export async function getSpreadsheetMetadata(
  spreadsheetId: string
): Promise<{ title: string; sheetNames: string[] }> {
  const api = getSheetsApi()
  const res = await api.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title,sheets.properties.title',
  })
  const title = res.data.properties?.title ?? 'Untitled'
  const sheetNames =
    res.data.sheets?.map((s) => s.properties?.title ?? '') ?? []
  console.log(`[sheetsClient] metadata for ${spreadsheetId}: "${title}", sheets: ${sheetNames.join(', ')}`)
  return { title, sheetNames }
}

export interface SpreadsheetInfo {
  title: string
  locale: string
  timeZone: string
  sheets: Array<{
    sheetId: number
    title: string
    index: number
    rowCount: number
    columnCount: number
  }>
}

export async function getSpreadsheetInfo(spreadsheetId: string): Promise<SpreadsheetInfo> {
  const api = getSheetsApi()
  const res = await api.spreadsheets.get({
    spreadsheetId,
    fields: 'properties,sheets.properties',
  })
  const props = res.data.properties
  return {
    title: props?.title ?? 'Untitled',
    locale: props?.locale ?? 'unknown',
    timeZone: props?.timeZone ?? 'unknown',
    sheets: (res.data.sheets ?? []).map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? '',
      index: s.properties?.index ?? 0,
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
    })),
  }
}

export async function listSheets(
  spreadsheetId: string
): Promise<Array<{ sheetId: number; title: string }>> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  return info.sheets.map((s) => ({ sheetId: s.sheetId, title: s.title }))
}

// ── Read / Write / Clear ──

export async function readRange(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const api = getSheetsApi()
  const res = await api.spreadsheets.values.get({ spreadsheetId, range })
  return (res.data.values as string[][]) ?? []
}

export async function writeRange(
  spreadsheetId: string,
  range: string,
  values: string[][],
  inputOption: string = 'USER_ENTERED'
): Promise<{ updatedRows: number; updatedColumns: number; updatedCells: number }> {
  const api = getSheetsApi()
  const res = await api.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: inputOption,
    requestBody: { values },
  })
  return {
    updatedRows: res.data.updatedRows ?? 0,
    updatedColumns: res.data.updatedColumns ?? 0,
    updatedCells: res.data.updatedCells ?? 0,
  }
}

export async function clearRange(
  spreadsheetId: string,
  range: string
): Promise<{ clearedRange: string }> {
  const api = getSheetsApi()
  const res = await api.spreadsheets.values.clear({
    spreadsheetId,
    range,
  })
  return { clearedRange: res.data.clearedRange ?? range }
}

// ── Sheet management (batchUpdate) ──

async function batchUpdate(spreadsheetId: string, requests: sheets_v4.Schema$Request[]): Promise<void> {
  const api = getSheetsApi()
  await api.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  })
}

export async function addSheet(
  spreadsheetId: string,
  title: string,
  options?: { rowCount?: number; columnCount?: number }
): Promise<{ sheetId: number }> {
  const api = getSheetsApi()
  const gridProperties: any = {}
  if (options?.rowCount) gridProperties.rowCount = options.rowCount
  if (options?.columnCount) gridProperties.columnCount = options.columnCount

  const res = await api.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title,
            ...(Object.keys(gridProperties).length > 0 ? { gridProperties } : {})
          }
        }
      }],
    },
  })
  const sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0
  return { sheetId }
}

export async function deleteSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName)
  await batchUpdate(spreadsheetId, [
    { deleteSheet: { sheetId } },
  ])
}

export async function renameSheet(
  spreadsheetId: string,
  oldName: string,
  newName: string
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheet = info.sheets.find((s) => s.title === oldName)
  if (!sheet) throw new Error(`Sheet "${oldName}" not found`)
  await batchUpdate(spreadsheetId, [
    {
      updateSheetProperties: {
        properties: { sheetId: sheet.sheetId, title: newName },
        fields: 'title',
      },
    },
  ])
}

export async function reorderSheets(
  spreadsheetId: string,
  order: string[]
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const requests: sheets_v4.Schema$Request[] = []

  for (let i = 0; i < order.length; i++) {
    const sheet = info.sheets.find((s) => s.title === order[i])
    if (!sheet) throw new Error(`Sheet "${order[i]}" not found`)
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: sheet.sheetId, index: i },
        fields: 'index',
      },
    })
  }

  if (requests.length > 0) {
    await batchUpdate(spreadsheetId, requests)
  }
}

// ── Formatting ──

export interface FormatSpec {
  bold?: boolean
  numberFormat?: 'CURRENCY' | 'PERCENT' | 'DATE' | 'NUMBER'
  columnWidth?: number
  backgroundColor?: string // hex color like "#FF0000" or named like "red"
  textColor?: string // hex color like "#FFFFFF"
  borders?: boolean | 'all' | 'outer' // true = all borders, 'outer' = outer only
  horizontalAlignment?: 'LEFT' | 'CENTER' | 'RIGHT'
}

export function a1ToGridRange(a1Range: string, sheetId: number): sheets_v4.Schema$GridRange {
  const rangePart = a1Range.includes('!') ? a1Range.split('!')[1] : a1Range
  const match = rangePart.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i)
  if (!match) throw new Error(`Cannot parse range "${a1Range}" for formatting`)

  const startCol = colLetterToIndex(match[1])
  const startRow = parseInt(match[2], 10) - 1
  const endCol = match[3] ? colLetterToIndex(match[3]) + 1 : startCol + 1
  const endRow = match[4] ? parseInt(match[4], 10) : startRow + 1

  return { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol }
}

export async function formatRange(
  spreadsheetId: string,
  a1Range: string,
  format: FormatSpec
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = a1Range.includes('!') ? a1Range.split('!')[0] : info.sheets[0]?.title ?? ''
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(a1Range, sheet.sheetId)
  const requests: sheets_v4.Schema$Request[] = []

  if (format.bold !== undefined) {
    requests.push({
      repeatCell: {
        range: gridRange,
        cell: { userEnteredFormat: { textFormat: { bold: format.bold } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    })
  }

  if (format.numberFormat) {
    const patterns: Record<string, { type: string; pattern: string }> = {
      CURRENCY: { type: 'CURRENCY', pattern: '$#,##0.00' },
      PERCENT: { type: 'PERCENT', pattern: '0.00%' },
      DATE: { type: 'DATE', pattern: 'yyyy-mm-dd' },
      NUMBER: { type: 'NUMBER', pattern: '#,##0.00' },
    }
    const fmt = patterns[format.numberFormat]
    if (fmt) {
      requests.push({
        repeatCell: {
          range: gridRange,
          cell: { userEnteredFormat: { numberFormat: fmt } },
          fields: 'userEnteredFormat.numberFormat',
        },
      })
    }
  }

  if (format.columnWidth && format.columnWidth > 0) {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: sheet.sheetId,
          dimension: 'COLUMNS',
          startIndex: gridRange.startColumnIndex!,
          endIndex: gridRange.endColumnIndex!,
        },
        properties: { pixelSize: format.columnWidth },
        fields: 'pixelSize',
      },
    })
  }

  // Background color
  if (format.backgroundColor) {
    const color = hexToRgb(format.backgroundColor)
    requests.push({
      repeatCell: {
        range: gridRange,
        cell: { userEnteredFormat: { backgroundColor: color } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    })
  }

  // Text color
  if (format.textColor) {
    const color = hexToRgb(format.textColor)
    requests.push({
      repeatCell: {
        range: gridRange,
        cell: { userEnteredFormat: { textFormat: { foregroundColor: color } } },
        fields: 'userEnteredFormat.textFormat.foregroundColor',
      },
    })
  }

  // Horizontal alignment
  if (format.horizontalAlignment) {
    requests.push({
      repeatCell: {
        range: gridRange,
        cell: { userEnteredFormat: { horizontalAlignment: format.horizontalAlignment } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    })
  }

  // Borders
  if (format.borders) {
    const borderStyle = {
      style: 'SOLID',
      width: 1,
      color: { red: 0.8, green: 0.8, blue: 0.8 }, // light gray
    }

    if (format.borders === 'outer') {
      // Only outer borders
      requests.push({
        updateBorders: {
          range: gridRange,
          top: borderStyle,
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle,
        },
      })
    } else {
      // All borders (including inner)
      requests.push({
        updateBorders: {
          range: gridRange,
          top: borderStyle,
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle,
          innerHorizontal: borderStyle,
          innerVertical: borderStyle,
        },
      })
    }
  }

  if (requests.length > 0) {
    await batchUpdate(spreadsheetId, requests)
  }
}

/**
 * Convert hex color to RGB object for Google Sheets API
 */
function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  // Handle named colors
  const namedColors: Record<string, string> = {
    red: '#FF0000',
    green: '#00FF00',
    blue: '#0000FF',
    yellow: '#FFFF00',
    orange: '#FFA500',
    purple: '#800080',
    pink: '#FFC0CB',
    gray: '#808080',
    black: '#000000',
    white: '#FFFFFF',
  }

  let color = hex.toLowerCase()
  if (namedColors[color]) {
    color = namedColors[color]
  }

  // Remove # if present
  color = color.replace('#', '')

  // Convert to RGB (0-1 range for Google Sheets)
  const r = parseInt(color.substring(0, 2), 16) / 255
  const g = parseInt(color.substring(2, 4), 16) / 255
  const b = parseInt(color.substring(4, 6), 16) / 255

  return { red: r, green: g, blue: b }
}

// ── Row / Column insert & delete ──

export async function insertDimension(
  spreadsheetId: string,
  sheetName: string,
  dimension: 'ROWS' | 'COLUMNS',
  startIndex: number, // 0-based
  count: number
): Promise<void> {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName)
  await batchUpdate(spreadsheetId, [
    {
      insertDimension: {
        range: { sheetId, dimension, startIndex, endIndex: startIndex + count },
        inheritFromBefore: startIndex > 0,
      },
    },
  ])
}

export async function deleteDimension(
  spreadsheetId: string,
  sheetName: string,
  dimension: 'ROWS' | 'COLUMNS',
  startIndex: number, // 0-based
  count: number
): Promise<void> {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName)
  await batchUpdate(spreadsheetId, [
    {
      deleteDimension: {
        range: { sheetId, dimension, startIndex, endIndex: startIndex + count },
      },
    },
  ])
}

// ── Sort range ──

export async function sortRangeApi(
  spreadsheetId: string,
  a1Range: string,
  sortSpecs: Array<{ dimensionIndex: number; sortOrder: 'ASCENDING' | 'DESCENDING' }>
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = a1Range.includes('!') ? a1Range.split('!')[0] : info.sheets[0]?.title ?? ''
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(a1Range, sheet.sheetId)

  await batchUpdate(spreadsheetId, [
    {
      sortRange: {
        range: gridRange,
        sortSpecs: sortSpecs.map((s) => ({
          dimensionIndex: s.dimensionIndex,
          sortOrder: s.sortOrder,
        })),
      },
    },
  ])
}

// ── Duplicate sheet ──

export async function duplicateSheet(
  spreadsheetId: string,
  sheetName: string,
  newName: string
): Promise<{ sheetId: number; name: string }> {
  const sourceSheetId = await getSheetIdByName(spreadsheetId, sheetName)
  const api = getSheetsApi()
  const res = await api.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ duplicateSheet: { sourceSheetId, newSheetName: newName } }],
    },
  })
  const newSheetId = res.data.replies?.[0]?.duplicateSheet?.properties?.sheetId ?? 0
  return { sheetId: newSheetId, name: newName }
}

// ── Conditional formatting ──

export async function addConditionalFormatRule(
  spreadsheetId: string,
  a1Range: string,
  conditionType: string,
  conditionValues: string[],
  format: { bold?: boolean; bgColor?: string; textColor?: string }
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = a1Range.includes('!') ? a1Range.split('!')[0] : info.sheets[0]?.title ?? ''
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(a1Range, sheet.sheetId)

  const cellFormat: sheets_v4.Schema$CellFormat = {}
  if (format.bold !== undefined) {
    cellFormat.textFormat = { bold: format.bold }
  }
  if (format.bgColor) {
    cellFormat.backgroundColor = hexToRgb(format.bgColor)
  }
  if (format.textColor) {
    cellFormat.textFormat = { ...(cellFormat.textFormat || {}), foregroundColor: hexToRgb(format.textColor) }
  }

  await batchUpdate(spreadsheetId, [
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [gridRange],
          booleanRule: {
            condition: {
              type: conditionType,
              values: conditionValues.map((v) => ({ userEnteredValue: v })),
            },
            format: cellFormat,
          },
        },
        index: 0,
      },
    },
  ])
}

// ── Data validation ──

export async function setDataValidation(
  spreadsheetId: string,
  a1Range: string,
  conditionType: string,
  conditionValues: string[],
  strict: boolean = true,
  inputMessage?: string
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = a1Range.includes('!') ? a1Range.split('!')[0] : info.sheets[0]?.title ?? ''
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(a1Range, sheet.sheetId)

  await batchUpdate(spreadsheetId, [
    {
      repeatCell: {
        range: gridRange,
        cell: {
          dataValidation: {
            condition: {
              type: conditionType,
              values: conditionValues.map((v) => ({ userEnteredValue: v })),
            },
            strict,
            showCustomUi: true,
            inputMessage: inputMessage || undefined,
          },
        },
        fields: 'dataValidation',
      },
    },
  ])
}

// ── Basic filter ──

export async function setBasicFilter(
  spreadsheetId: string,
  a1Range: string
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = a1Range.includes('!') ? a1Range.split('!')[0] : info.sheets[0]?.title ?? ''
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(a1Range, sheet.sheetId)

  await batchUpdate(spreadsheetId, [
    {
      setBasicFilter: {
        filter: { range: gridRange },
      },
    },
  ])
}

export async function clearBasicFilter(
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName)
  await batchUpdate(spreadsheetId, [
    { clearBasicFilter: { sheetId } },
  ])
}

// ── Named ranges ──

export async function addNamedRangeApi(
  spreadsheetId: string,
  name: string,
  a1Range: string
): Promise<{ namedRangeId: string }> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = a1Range.includes('!') ? a1Range.split('!')[0] : info.sheets[0]?.title ?? ''
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(a1Range, sheet.sheetId)
  const api = getSheetsApi()
  const res = await api.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addNamedRange: { namedRange: { name, range: gridRange } } }],
    },
  })
  const namedRangeId = res.data.replies?.[0]?.addNamedRange?.namedRange?.namedRangeId ?? ''
  return { namedRangeId }
}

export async function deleteNamedRangeApi(
  spreadsheetId: string,
  name: string
): Promise<void> {
  const api = getSheetsApi()
  const meta = await api.spreadsheets.get({
    spreadsheetId,
    fields: 'namedRanges',
  })
  const nr = meta.data.namedRanges?.find((r) => r.name === name)
  if (!nr || !nr.namedRangeId) throw new Error(`Named range "${name}" not found`)

  await batchUpdate(spreadsheetId, [
    { deleteNamedRange: { namedRangeId: nr.namedRangeId } },
  ])
}

// ── Merge / Unmerge cells ──

export async function mergeCellsApi(
  spreadsheetId: string,
  a1Range: string,
  mergeType: string = 'MERGE_ALL'
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = a1Range.includes('!') ? a1Range.split('!')[0] : info.sheets[0]?.title ?? ''
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(a1Range, sheet.sheetId)
  await batchUpdate(spreadsheetId, [{ mergeCells: { range: gridRange, mergeType } }])
}

export async function unmergeCellsApi(
  spreadsheetId: string,
  a1Range: string
): Promise<void> {
  const info = await getSpreadsheetInfo(spreadsheetId)
  const sheetName = a1Range.includes('!') ? a1Range.split('!')[0] : info.sheets[0]?.title ?? ''
  const sheet = info.sheets.find((s) => s.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`)

  const gridRange = a1ToGridRange(a1Range, sheet.sheetId)
  await batchUpdate(spreadsheetId, [{ unmergeCells: { range: gridRange } }])
}

// ── Freeze rows / columns ──

export async function freezeRowsCols(
  spreadsheetId: string,
  sheetName: string,
  frozenRowCount?: number,
  frozenColumnCount?: number
): Promise<void> {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName)

  const gridProperties: Record<string, number> = {}
  const fields: string[] = []
  if (frozenRowCount !== undefined) {
    gridProperties.frozenRowCount = frozenRowCount
    fields.push('gridProperties.frozenRowCount')
  }
  if (frozenColumnCount !== undefined) {
    gridProperties.frozenColumnCount = frozenColumnCount
    fields.push('gridProperties.frozenColumnCount')
  }
  if (fields.length === 0) return

  await batchUpdate(spreadsheetId, [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties },
        fields: fields.join(','),
      },
    },
  ])
}

// ── Pivot table ──

export interface PivotValueSpec {
  sourceColumnOffset: number
  summarizeFunction: string
}

export async function addPivotTableRaw(
  spreadsheetId: string,
  sourceGridRange: sheets_v4.Schema$GridRange,
  targetSheetId: number,
  targetRow: number,
  targetCol: number,
  pivotRows: number[],
  pivotCols: number[],
  pivotValues: PivotValueSpec[]
): Promise<void> {
  const api = getSheetsApi()
  await api.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            rows: [
              {
                values: [
                  {
                    pivotTable: {
                      source: sourceGridRange,
                      rows: pivotRows.map((offset) => ({
                        sourceColumnOffset: offset,
                        showTotals: true,
                        sortOrder: 'ASCENDING',
                      })),
                      columns: pivotCols.map((offset) => ({
                        sourceColumnOffset: offset,
                        showTotals: true,
                        sortOrder: 'ASCENDING',
                      })),
                      values: pivotValues.map((v) => ({
                        sourceColumnOffset: v.sourceColumnOffset,
                        summarizeFunction: v.summarizeFunction,
                      })),
                    },
                  },
                ],
              },
            ],
            start: {
              sheetId: targetSheetId,
              rowIndex: targetRow,
              columnIndex: targetCol,
            },
            fields: 'pivotTable',
          },
        },
      ],
    },
  })
}

// ── Charts ──

export async function addChartRaw(
  spreadsheetId: string,
  spec: sheets_v4.Schema$ChartSpec,
  anchorSheetId: number,
  anchorRow: number,
  anchorCol: number
): Promise<{ chartId: number }> {
  const api = getSheetsApi()
  const res = await api.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addChart: {
            chart: {
              spec,
              position: {
                overlayPosition: {
                  anchorCell: {
                    sheetId: anchorSheetId,
                    rowIndex: anchorRow,
                    columnIndex: anchorCol,
                  },
                },
              },
            },
          },
        },
      ],
    },
  })
  const chartId = res.data.replies?.[0]?.addChart?.chart?.chartId ?? 0
  return { chartId }
}
