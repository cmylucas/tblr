export interface ParsedSheet {
  spreadsheetId: string
  gid?: string
}

/**
 * Extract spreadsheetId (and optionally gid) from a Google Sheets URL.
 * Supports URLs like:
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=SHEET_ID
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit?gid=SHEET_ID
 */
export function parseSheetUrl(url: string): ParsedSheet {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) {
    throw new Error('Invalid Google Sheets URL — could not extract spreadsheetId')
  }

  const spreadsheetId = match[1]

  // Try to extract gid from fragment or query
  let gid: string | undefined
  const gidHashMatch = url.match(/[#&?]gid=(\d+)/)
  if (gidHashMatch) {
    gid = gidHashMatch[1]
  }

  return { spreadsheetId, gid }
}
