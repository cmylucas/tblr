import { google, sheets_v4 } from 'googleapis'
import { getOAuth2Client } from '../auth/googleAuth'

function getSheetsApi(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getOAuth2Client() })
}

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

export async function readRange(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const api = getSheetsApi()
  const res = await api.spreadsheets.values.get({
    spreadsheetId,
    range,
  })
  return (res.data.values as string[][]) ?? []
}

export async function writeRange(
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<{ updatedRows: number; updatedColumns: number }> {
  const api = getSheetsApi()
  const res = await api.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })
  return {
    updatedRows: res.data.updatedRows ?? 0,
    updatedColumns: res.data.updatedColumns ?? 0,
  }
}
