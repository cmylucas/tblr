/**
 * Template store - in-memory cache + disk persistence
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { TemplateMeta, TemplateRun } from './templateTypes'

const templateCache = new Map<string, TemplateMeta>()
const runCache = new Map<string, TemplateRun>()

let templatesBaseDir: string
let runsBaseDir: string

/**
 * Initialize the template store. Must be called before any other operations.
 */
export function initializeTemplateStore(): void {
  templatesBaseDir = path.join(app.getPath('userData'), 'templates')
  runsBaseDir = path.join(app.getPath('userData'), 'template-runs')

  fs.mkdirSync(templatesBaseDir, { recursive: true })
  fs.mkdirSync(runsBaseDir, { recursive: true })

  loadAllTemplates()
  loadAllRuns()

  console.log(
    `[templateStore] Initialized with ${templateCache.size} template(s), ${runCache.size} run(s)`
  )
}

/**
 * Load all templates from disk into memory cache
 */
function loadAllTemplates(): void {
  if (!fs.existsSync(templatesBaseDir)) return

  const entries = fs.readdirSync(templatesBaseDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const templateId = entry.name
    const metadataPath = path.join(templatesBaseDir, templateId, 'metadata.json')

    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as TemplateMeta
        templateCache.set(templateId, metadata)
      } catch (err) {
        console.error(`[templateStore] Failed to load template ${templateId}:`, err)
      }
    }
  }
}

/**
 * Load all runs from disk into memory cache
 */
function loadAllRuns(): void {
  if (!fs.existsSync(runsBaseDir)) return

  const files = fs.readdirSync(runsBaseDir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue

    try {
      const runPath = path.join(runsBaseDir, file)
      const run = JSON.parse(fs.readFileSync(runPath, 'utf-8')) as TemplateRun
      runCache.set(run.runId, run)
    } catch (err) {
      console.error(`[templateStore] Failed to load run ${file}:`, err)
    }
  }
}

/**
 * Create a new template
 */
export function createTemplate(metadata: TemplateMeta): TemplateMeta {
  const templateDir = path.join(templatesBaseDir, metadata.templateId)
  fs.mkdirSync(templateDir, { recursive: true })

  saveTemplateMetadata(metadata.templateId, metadata)
  templateCache.set(metadata.templateId, metadata)

  return metadata
}

/**
 * List all templates
 */
export function listTemplates(): TemplateMeta[] {
  return Array.from(templateCache.values()).sort((a, b) => b.uploadedAt - a.uploadedAt)
}

/**
 * Get a single template by ID
 */
export function getTemplate(templateId: string): TemplateMeta | undefined {
  return templateCache.get(templateId)
}

/**
 * Update an existing template's metadata
 */
export function updateTemplate(templateId: string, updates: Partial<TemplateMeta>): TemplateMeta {
  const existing = templateCache.get(templateId)
  if (!existing) {
    throw new Error(`Template ${templateId} not found`)
  }

  const updated = { ...existing, ...updates }
  saveTemplateMetadata(templateId, updated)
  templateCache.set(templateId, updated)

  return updated
}

/**
 * Delete a template (removes from disk and cache)
 */
export function deleteTemplate(templateId: string): void {
  const templateDir = path.join(templatesBaseDir, templateId)

  if (fs.existsSync(templateDir)) {
    fs.rmSync(templateDir, { recursive: true, force: true })
  }

  templateCache.delete(templateId)
}

/**
 * Save a template run
 */
export function saveTemplateRun(run: TemplateRun): void {
  const runPath = path.join(runsBaseDir, `${run.runId}.json`)
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2), 'utf-8')
  runCache.set(run.runId, run)
}

/**
 * Get a template run by ID
 */
export function getTemplateRun(runId: string): TemplateRun | undefined {
  return runCache.get(runId)
}

/**
 * Update a template run
 */
export function updateTemplateRun(runId: string, updates: Partial<TemplateRun>): TemplateRun {
  const existing = runCache.get(runId)
  if (!existing) {
    throw new Error(`Run ${runId} not found`)
  }

  const updated = { ...existing, ...updates }
  saveTemplateRun(updated)

  return updated
}

/**
 * List all template runs (optionally filtered by template)
 */
export function listTemplateRuns(templateId?: string): TemplateRun[] {
  let runs = Array.from(runCache.values())

  if (templateId) {
    runs = runs.filter((r) => r.templateId === templateId)
  }

  return runs.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Delete a template run
 */
export function deleteTemplateRun(runId: string): void {
  const runPath = path.join(runsBaseDir, `${runId}.json`)

  if (fs.existsSync(runPath)) {
    fs.unlinkSync(runPath)
  }

  runCache.delete(runId)
}

/**
 * Get the path to a template's directory
 */
export function getTemplateDir(templateId: string): string {
  return path.join(templatesBaseDir, templateId)
}

/**
 * Save template metadata to disk
 */
function saveTemplateMetadata(templateId: string, metadata: TemplateMeta): void {
  const metadataPath = path.join(templatesBaseDir, templateId, 'metadata.json')
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
}
