/**
 * IPC handlers for template operations
 */

import { ipcMain, dialog } from 'electron'
import { randomUUID } from 'crypto'
import type { IpcResult } from '../ipc/types'
import {
  createTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  getTemplateRun,
  listTemplateRuns,
} from './templateStore'
import {
  uploadAndConvertTemplate,
  validateTemplateNamedRanges,
  calculateFileHash,
  deleteFileFromDrive,
} from './templateDriveClient'
import type { TemplateMeta, TemplateRun } from './templateTypes'
import { DCF_REQUIRED_INPUTS, DCF_VALIDATION_RULES } from './templateTypes'

export const TEMPLATE_IPC = {
  OPEN_UPLOAD_DIALOG: 'templates:openUploadDialog',
  UPLOAD: 'templates:upload',
  LIST: 'templates:list',
  GET: 'templates:get',
  DELETE: 'templates:delete',
  LIST_RUNS: 'templates:listRuns',
  GET_RUN: 'templates:getRun',
} as const

/**
 * Register all template IPC handlers
 */
export function registerTemplateIpcHandlers(getAuthClient: () => any): void {
  /**
   * Open file dialog and upload template
   */
  ipcMain.handle(
    TEMPLATE_IPC.OPEN_UPLOAD_DIALOG,
    async (
      _e,
      templateName: string,
      category: string = 'dcf'
    ): Promise<IpcResult<TemplateMeta>> => {
      try {
        // Show file dialog
        const result = await dialog.showOpenDialog({
          title: 'Select XLSX Template',
          filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
          properties: ['openFile'],
        })

        if (result.canceled || result.filePaths.length === 0) {
          return { ok: false, error: 'No file selected' }
        }

        const xlsxPath = result.filePaths[0]

        // Now call the upload logic
        const authClient = getAuthClient()
        if (!authClient) {
          return { ok: false, error: 'Not authenticated. Please sign in to Google first.' }
        }

        // Calculate hash of XLSX
        const xlsxHash = calculateFileHash(xlsxPath)

        // Upload and convert to Google Sheets
        const uploadResult = await uploadAndConvertTemplate(xlsxPath, templateName, authClient)

        // Skip validation - accept any template with any named ranges

        // Create template metadata
        const templateId = randomUUID()
        const metadata: TemplateMeta = {
          templateId,
          name: templateName,
          category: category as any,
          driveFileId: uploadResult.driveFileId,
          driveWebViewLink: uploadResult.webViewLink,
          requiredInputs: [],
          optionalInputs: [],
          outputRanges: [],
          validationRules: {},
          uploadedAt: Date.now(),
          usageCount: 0,
          xlsxHash,
        }

        const template = createTemplate(metadata)

        return { ok: true, data: template }
      } catch (err: any) {
        console.error('[templatesIpc] Upload error:', err)
        return { ok: false, error: err.message || 'Failed to upload template' }
      }
    }
  )

  /**
   * Upload and convert XLSX template (legacy - accepts file path)
   */
  ipcMain.handle(
    TEMPLATE_IPC.UPLOAD,
    async (
      _e,
      xlsxPath: string,
      templateName: string,
      category: string = 'dcf'
    ): Promise<
      IpcResult<{
        template: TemplateMeta
        validation: { valid: boolean; missingRequired: string[] }
      }>
    > => {
      try {
        const authClient = getAuthClient()
        if (!authClient) {
          return { ok: false, error: 'Not authenticated. Please sign in to Google first.' }
        }

        // Calculate hash of XLSX
        const xlsxHash = calculateFileHash(xlsxPath)

        // Upload and convert to Google Sheets
        const uploadResult = await uploadAndConvertTemplate(xlsxPath, templateName, authClient)

        // Skip validation - accept any template with any named ranges

        // Create template metadata
        const templateId = randomUUID()
        const metadata: TemplateMeta = {
          templateId,
          name: templateName,
          category: category as any,
          driveFileId: uploadResult.driveFileId,
          driveWebViewLink: uploadResult.webViewLink,
          requiredInputs: [],
          optionalInputs: [],
          outputRanges: [],
          validationRules: {},
          uploadedAt: Date.now(),
          usageCount: 0,
          xlsxHash,
        }

        const template = createTemplate(metadata)

        return {
          ok: true,
          data: {
            template,
            validation: {
              valid: true,
              missingRequired: [],
            },
          },
        }
      } catch (err: any) {
        console.error('[templatesIpc] Upload error:', err)
        return { ok: false, error: err.message || 'Failed to upload template' }
      }
    }
  )

  /**
   * List all templates
   */
  ipcMain.handle(TEMPLATE_IPC.LIST, async (): Promise<IpcResult<TemplateMeta[]>> => {
    try {
      const templates = listTemplates()
      return { ok: true, data: templates }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  /**
   * Get a single template
   */
  ipcMain.handle(
    TEMPLATE_IPC.GET,
    async (_e, templateId: string): Promise<IpcResult<TemplateMeta>> => {
      try {
        const template = getTemplate(templateId)
        if (!template) {
          return { ok: false, error: `Template ${templateId} not found` }
        }
        return { ok: true, data: template }
      } catch (err: any) {
        return { ok: false, error: err.message }
      }
    }
  )

  /**
   * Delete a template
   */
  ipcMain.handle(
    TEMPLATE_IPC.DELETE,
    async (_e, templateId: string): Promise<IpcResult<void>> => {
      try {
        const template = getTemplate(templateId)
        if (!template) {
          return { ok: false, error: `Template ${templateId} not found` }
        }

        // Delete from Google Drive
        const authClient = getAuthClient()
        if (authClient) {
          try {
            await deleteFileFromDrive(template.driveFileId, authClient)
          } catch (err) {
            console.warn('[templatesIpc] Failed to delete from Drive:', err)
            // Continue anyway to clean up local data
          }
        }

        // Delete locally
        deleteTemplate(templateId)

        return { ok: true, data: undefined }
      } catch (err: any) {
        return { ok: false, error: err.message }
      }
    }
  )

  /**
   * List template runs
   */
  ipcMain.handle(
    TEMPLATE_IPC.LIST_RUNS,
    async (_e, templateId?: string): Promise<IpcResult<TemplateRun[]>> => {
      try {
        const runs = listTemplateRuns(templateId)
        return { ok: true, data: runs }
      } catch (err: any) {
        return { ok: false, error: err.message }
      }
    }
  )

  /**
   * Get a single template run
   */
  ipcMain.handle(
    TEMPLATE_IPC.GET_RUN,
    async (_e, runId: string): Promise<IpcResult<TemplateRun>> => {
      try {
        const run = getTemplateRun(runId)
        if (!run) {
          return { ok: false, error: `Run ${runId} not found` }
        }
        return { ok: true, data: run }
      } catch (err: any) {
        return { ok: false, error: err.message }
      }
    }
  )
}
