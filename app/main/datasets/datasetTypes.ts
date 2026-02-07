export interface DatasetMeta {
  datasetId: string
  name: string
  type: 'csv' | 'tsv'
  sizeBytes: number
  uploadedAt: number
  source: {
    type: 'upload' | 'sec-filing'
    original?: {
      filename: string
    }
    secFiling?: {
      pdfFilename: string
      cik: string
      ticker?: string
      detectionMethod: 'cik-text' | 'ticker-text' | 'ticker-filename' | 'user-input'
    }
  }
  stats: {
    rowCount: number
    colCount: number
    delimiter: 'TAB' | ','
    headers: string[]
  }
  dbInfo?: {
    dbPath: string
    rowCount: number
    indexesCreated: boolean
    summaryCreated: boolean
    catalogCreated: boolean
  }
}

export interface DatasetList {
  datasets: DatasetMeta[]
}
