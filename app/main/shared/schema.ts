import { z } from 'zod'

export const AttachSheetInput = z.object({
  url: z.string().url(),
})

export const ReadRangeInput = z.object({
  range: z.string().min(1),
})

export const WriteRangeInput = z.object({
  range: z.string().min(1),
  rawText: z.string().min(1),
})

// AI/Financial schemas
export const ColumnMappingSchema = z.object({
  dateColumn: z.number().int().min(0),
  amountColumn: z.number().int().min(0),
  categoryColumn: z.number().int().min(0).optional(),
  descriptionColumn: z.number().int().min(0).optional(),
})

export const AnalyzeFinancialDataInput = z.object({
  range: z.string().min(1),
  mapping: ColumnMappingSchema,
  context: z.string().optional(),
})
