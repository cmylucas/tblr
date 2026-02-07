import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import type { DatasetMeta } from './datasetTypes'
import type { CsvPreview, AttachmentChunk, ChunkCursor } from '../attachments/types'
import { parseFile, getPreview as getCsvPreview, readChunk as readCsvChunk } from '../attachments/parseCsvTsv'

// In-memory cache of all dataset metadata
const datasetCache = new Map<string, DatasetMeta>()

let datasetsBaseDir: string

/**
 * Initialize the dataset store. Must be called before any other operations.
 */
export function initializeDatasetStore(): void {
  datasetsBaseDir = path.join(app.getPath('userData'), 'datasets')
  fs.mkdirSync(datasetsBaseDir, { recursive: true })

  // Load all existing datasets into memory
  loadAllDatasets()

  console.log(`[datasetStore] Initialized with ${datasetCache.size} dataset(s) from ${datasetsBaseDir}`)
}

/**
 * Load all dataset metadata from disk into memory cache
 */
function loadAllDatasets(): void {
  if (!fs.existsSync(datasetsBaseDir)) return

  const entries = fs.readdirSync(datasetsBaseDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const datasetId = entry.name
    const metadataPath = path.join(datasetsBaseDir, datasetId, 'metadata.json')

    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as DatasetMeta
        datasetCache.set(datasetId, metadata)
      } catch (err) {
        console.error(`[datasetStore] Failed to load metadata for ${datasetId}:`, err)
      }
    }
  }
}

/**
 * Create a new dataset from a CSV/TSV file
 */
export function createDataset(filePath: string, partialMeta: Partial<DatasetMeta>): DatasetMeta {
  const datasetId = randomUUID()
  const datasetDir = path.join(datasetsBaseDir, datasetId)
  fs.mkdirSync(datasetDir, { recursive: true })

  // Parse file to get stats
  const { rows, delimiter } = parseFile(filePath)
  const colCount = Math.max(...rows.map((r) => r.length), 0)
  const ext = path.extname(filePath).toLowerCase()

  // Copy file to dataset directory
  const destPath = path.join(datasetDir, `data${ext}`)
  fs.copyFileSync(filePath, destPath)

  // Build complete metadata
  const metadata: DatasetMeta = {
    datasetId,
    name: partialMeta.name || 'Untitled Dataset',
    type: ext === '.csv' ? 'csv' : 'tsv',
    sizeBytes: fs.statSync(destPath).size,
    uploadedAt: Date.now(),
    source: partialMeta.source || {
      type: 'upload',
      original: { filename: path.basename(filePath) },
    },
    stats: {
      rowCount: Math.max(rows.length - 1, 0), // Exclude header
      colCount,
      delimiter: delimiter === '\t' ? 'TAB' : ',',
      headers: rows.length > 0 ? rows[0] : [],
    },
  }

  // Save metadata
  saveMetadata(datasetId, metadata)

  // Add to cache
  datasetCache.set(datasetId, metadata)

  return metadata
}

/**
 * Create dataset from existing CSV data (for SEC conversion)
 */
export function createDatasetFromCsv(csvPath: string, metadata: DatasetMeta): DatasetMeta {
  const datasetDir = path.join(datasetsBaseDir, metadata.datasetId)
  fs.mkdirSync(datasetDir, { recursive: true })

  // Copy CSV to dataset directory
  const destPath = path.join(datasetDir, 'data.csv')
  fs.copyFileSync(csvPath, destPath)

  // Update size
  metadata.sizeBytes = fs.statSync(destPath).size

  // Save metadata
  saveMetadata(metadata.datasetId, metadata)

  // Add to cache
  datasetCache.set(metadata.datasetId, metadata)

  return metadata
}

/**
 * List all datasets
 */
export function listDatasets(): DatasetMeta[] {
  return Array.from(datasetCache.values()).sort((a, b) => b.uploadedAt - a.uploadedAt)
}

/**
 * Get a single dataset by ID
 */
export function getDataset(datasetId: string): DatasetMeta | undefined {
  return datasetCache.get(datasetId)
}

/**
 * Update an existing dataset's metadata
 */
export function updateDataset(datasetId: string, updates: Partial<DatasetMeta>): DatasetMeta {
  const existing = datasetCache.get(datasetId)
  if (!existing) {
    throw new Error(`Dataset ${datasetId} not found`)
  }

  // Merge updates
  const updated = { ...existing, ...updates }

  // Save to disk
  saveMetadata(datasetId, updated)

  // Update cache
  datasetCache.set(datasetId, updated)

  return updated
}

/**
 * Delete a dataset (removes from disk and cache)
 */
export function deleteDataset(datasetId: string): void {
  const datasetDir = path.join(datasetsBaseDir, datasetId)

  if (fs.existsSync(datasetDir)) {
    fs.rmSync(datasetDir, { recursive: true, force: true })
  }

  datasetCache.delete(datasetId)
}

/**
 * Get preview of a dataset
 */
export function getDatasetPreview(datasetId: string): CsvPreview {
  const meta = datasetCache.get(datasetId)
  if (!meta) throw new Error(`Dataset ${datasetId} not found`)

  const dataPath = getDatasetPath(datasetId)
  return getCsvPreview(dataPath)
}

/**
 * Read a chunk of dataset data
 */
export function readDatasetChunk(datasetId: string, cursor: ChunkCursor): AttachmentChunk {
  const meta = datasetCache.get(datasetId)
  if (!meta) throw new Error(`Dataset ${datasetId} not found`)

  const dataPath = getDatasetPath(datasetId)
  return readCsvChunk(dataPath, cursor)
}

/**
 * Get the path to a dataset's data file
 */
export function getDatasetPath(datasetId: string): string {
  const meta = datasetCache.get(datasetId)
  if (!meta) throw new Error(`Dataset ${datasetId} not found`)

  const ext = meta.type === 'csv' ? '.csv' : '.tsv'
  return path.join(datasetsBaseDir, datasetId, `data${ext}`)
}

/**
 * Get the path to a dataset's metadata file
 */
function getMetadataPath(datasetId: string): string {
  return path.join(datasetsBaseDir, datasetId, 'metadata.json')
}

/**
 * Save metadata to disk
 */
function saveMetadata(datasetId: string, metadata: DatasetMeta): void {
  const metadataPath = getMetadataPath(datasetId)
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
}
