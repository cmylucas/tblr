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
