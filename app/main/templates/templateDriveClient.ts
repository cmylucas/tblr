/**
 * Google Drive API client for template operations
 */

import { google } from 'googleapis'
import * as fs from 'fs'
import * as crypto from 'crypto'
import type { OAuth2Client } from 'google-auth-library'

export interface UploadResult {
  driveFileId: string
  webViewLink: string
  name: string
}

export interface NamedRangeValidation {
  valid: boolean
  foundRanges: string[]
  missingRequired: string[]
  errors: string[]
}

export interface CopyResult {
  newSpreadsheetId: string
  newWebViewLink: string
}

/**
 * Upload XLSX file to Google Drive and convert to Google Sheets
 */
export async function uploadAndConvertTemplate(
  xlsxPath: string,
  templateName: string,
  authClient: OAuth2Client
): Promise<UploadResult> {
  const drive = google.drive({ version: 'v3', auth: authClient })

  const fileMetadata = {
    name: templateName,
    mimeType: 'application/vnd.google-apps.spreadsheet', // Forces conversion
  }

  const media = {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: fs.createReadStream(xlsxPath),
  }

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, name, createdTime',
  })

  return {
    driveFileId: response.data.id!,
    webViewLink: response.data.webViewLink!,
    name: response.data.name!,
  }
}

/**
 * Validate that a spreadsheet has required named ranges
 */
export async function validateTemplateNamedRanges(
  spreadsheetId: string,
  requiredRanges: string[],
  authClient: OAuth2Client
): Promise<NamedRangeValidation> {
  const sheets = google.sheets({ version: 'v4', auth: authClient })

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'namedRanges',
  })

  const namedRanges = response.data.namedRanges || []
  const foundRanges = namedRanges.map((nr) => nr.name!).filter(Boolean)

  const missingRequired = requiredRanges.filter((r) => !foundRanges.includes(r))

  const errors: string[] = []
  if (missingRequired.length > 0) {
    errors.push(`Missing required named ranges: ${missingRequired.join(', ')}`)
  }

  return {
    valid: missingRequired.length === 0,
    foundRanges,
    missingRequired,
    errors,
  }
}

/**
 * Copy a template to create a new spreadsheet for a model run
 */
export async function copyTemplate(
  templateDriveFileId: string,
  newName: string,
  authClient: OAuth2Client
): Promise<CopyResult> {
  const drive = google.drive({ version: 'v3', auth: authClient })

  const response = await drive.files.copy({
    fileId: templateDriveFileId,
    requestBody: {
      name: newName,
    },
    fields: 'id, webViewLink',
  })

  return {
    newSpreadsheetId: response.data.id!,
    newWebViewLink: response.data.webViewLink!,
  }
}

/**
 * Set inputs in a spreadsheet via named ranges
 */
export async function setTemplateInputs(
  spreadsheetId: string,
  inputs: Record<string, string | number>,
  authClient: OAuth2Client
): Promise<{ success: boolean; errors: string[] }> {
  const sheets = google.sheets({ version: 'v4', auth: authClient })
  const errors: string[] = []

  // Build batch update data
  const data: any[] = []

  for (const [rangeName, value] of Object.entries(inputs)) {
    // Format value based on type
    let formattedValue: any
    if (typeof value === 'number') {
      formattedValue = value
    } else if (typeof value === 'string') {
      formattedValue = value
    } else {
      errors.push(`Invalid value type for ${rangeName}`)
      continue
    }

    data.push({
      range: rangeName, // Named range
      values: [[formattedValue]],
    })
  }

  if (data.length === 0) {
    return { success: false, errors: ['No valid inputs to set'] }
  }

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED', // Allows formulas if needed
        data,
      },
    })

    return { success: true, errors }
  } catch (err: any) {
    return { success: false, errors: [err.message] }
  }
}

/**
 * Read outputs from named ranges
 */
export async function readTemplateOutputs(
  spreadsheetId: string,
  outputRanges: string[],
  authClient: OAuth2Client
): Promise<Record<string, any>> {
  const sheets = google.sheets({ version: 'v4', auth: authClient })

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: outputRanges,
    valueRenderOption: 'UNFORMATTED_VALUE', // Get actual numbers
  })

  const outputs: Record<string, any> = {}

  for (let i = 0; i < outputRanges.length; i++) {
    const range = outputRanges[i]
    const valueRange = response.data.valueRanges![i]
    const value = valueRange.values?.[0]?.[0]
    outputs[range] = value
  }

  return outputs
}

/**
 * Calculate SHA256 hash of a file
 */
export function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath)
  const hashSum = crypto.createHash('sha256')
  hashSum.update(fileBuffer)
  return hashSum.digest('hex')
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFileFromDrive(
  driveFileId: string,
  authClient: OAuth2Client
): Promise<void> {
  const drive = google.drive({ version: 'v3', auth: authClient })
  await drive.files.delete({
    fileId: driveFileId,
  })
}
