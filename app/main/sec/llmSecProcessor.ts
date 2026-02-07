import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import { readChunk } from '../attachments/extractPdfText'
import { getOpenAIClient } from '../llm/openaiClient'

export interface LlmSecProcessingResult {
  datasetId: string
  rowCount: number
  colCount: number
  csvPath: string
  method: 'llm-conversion'
}

/**
 * Process a PDF SEC filing using LLM:
 * 1. Extract text from PDF
 * 2. Send to LLM with prompt to convert to CSV
 * 3. Parse LLM response and save as CSV
 * 4. Return metadata for dataset creation
 */
export async function processPdfWithLlm(
  pdfPath: string,
  pdfFilename: string
): Promise<LlmSecProcessingResult> {
  console.log(`[llmSecProcessor] Processing PDF with LLM: ${pdfFilename}`)

  // Step 1: Extract text from PDF
  console.log(`[llmSecProcessor] Extracting text from PDF...`)
  const pdfText = await extractPdfText(pdfPath)

  if (!pdfText || pdfText.trim().length < 100) {
    throw new Error('PDF text extraction failed or returned insufficient content')
  }

  console.log(`[llmSecProcessor] Extracted ${pdfText.length} characters from PDF`)

  // Step 2: Send to LLM for conversion
  console.log(`[llmSecProcessor] Sending to LLM for CSV conversion...`)
  const csvContent = await convertPdfToCSV(pdfText, pdfFilename)

  // Step 3: Parse CSV to get row/col counts
  const rows = csvContent.trim().split('\n')
  const rowCount = Math.max(0, rows.length - 1) // Exclude header
  const colCount = rows.length > 0 ? rows[0].split(',').length : 0

  // Step 4: Save to temp file
  const tempDir = path.join(app.getPath('temp'), 'llm-sec-conversions')
  fs.mkdirSync(tempDir, { recursive: true })

  const datasetId = randomUUID()
  const csvPath = path.join(tempDir, `${datasetId}.csv`)
  fs.writeFileSync(csvPath, csvContent, 'utf-8')

  console.log(`[llmSecProcessor] Created CSV: ${rowCount} rows, ${colCount} cols`)

  return {
    datasetId,
    rowCount,
    colCount,
    csvPath,
    method: 'llm-conversion',
  }
}

/**
 * Extract text from PDF file (all pages)
 */
async function extractPdfText(pdfPath: string): Promise<string> {
  try {
    // Generate a unique fileId for this extraction
    const fileId = randomUUID()

    // Read all pages from PDF using existing extraction logic
    const chunks: string[] = []
    let currentPage = 1
    const PAGES_PER_BATCH = 10

    while (true) {
      const result = await readChunk(pdfPath, fileId, {
        type: 'pages',
        startPage: currentPage,
        endPage: currentPage + PAGES_PER_BATCH - 1,
      })

      if (result.content) {
        chunks.push(result.content)
      }

      if (!result.nextCursor) {
        break
      }

      currentPage = (result.nextCursor as any).startPage
    }

    return chunks.join('\n\n')
  } catch (err: any) {
    console.error('[llmSecProcessor] PDF extraction error:', err)
    throw new Error(`Failed to extract text from PDF: ${err.message}`)
  }
}

/**
 * Use LLM to convert PDF text to CSV format
 */
async function convertPdfToCSV(pdfText: string, filename: string): Promise<string> {
  const client = getOpenAIClient()

  // Truncate PDF text if too long (max ~50k chars to stay under token limits)
  const MAX_TEXT_LENGTH = 50000
  const truncatedText = pdfText.length > MAX_TEXT_LENGTH
    ? pdfText.substring(0, MAX_TEXT_LENGTH) + '\n\n[... truncated ...]'
    : pdfText

  const prompt = `You are a financial data extraction expert. I have a SEC filing PDF (${filename}) with the following text content:

<pdf_content>
${truncatedText}
</pdf_content>

Please analyze this PDF and extract all financial data into a well-structured CSV format. Follow these rules:

1. **Headers**: Create clear, descriptive column headers (e.g., "Metric", "Period", "Value", "Unit", "Statement")
2. **Financial Metrics**: Extract ALL financial line items (revenue, expenses, assets, liabilities, cash flows, etc.)
3. **Time Periods**: Capture the reporting period for each metric (e.g., "2023-Q4", "FY2023", "2023-12-31")
4. **Values**: Extract numerical values WITHOUT formatting characters (no $, commas, parentheses)
   - Negatives should use minus sign: -1000 (not (1,000) or ($1,000))
5. **Units**: Include a unit column (e.g., "USD", "Thousands", "Millions", "Shares")
6. **Statement Source**: Indicate which statement each metric is from (e.g., "Income Statement", "Balance Sheet", "Cash Flow")
7. **Consistency**: Ensure all rows have the same number of columns
8. **No extra text**: Output ONLY the CSV content, no explanations or markdown code blocks

Example output format:
Metric,Period,Value,Unit,Statement
Revenue,2023-Q4,50000000,USD,Income Statement
Cost of Revenue,2023-Q4,-30000000,USD,Income Statement
Gross Profit,2023-Q4,20000000,USD,Income Statement

Now convert the PDF to CSV:`

  try {
    const response = await client.chat.completions.create({
      model: 'openai/gpt-4o', // Use GPT-4o for best extraction quality
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent, deterministic output
      max_tokens: 8000,
    })

    const csvContent = response.choices[0]?.message?.content?.trim()

    if (!csvContent) {
      throw new Error('LLM returned empty response')
    }

    // Clean up the response (remove markdown code blocks if present)
    let cleanedCSV = csvContent
    if (cleanedCSV.startsWith('```')) {
      cleanedCSV = cleanedCSV.replace(/^```(?:csv)?\n/, '').replace(/\n```$/, '')
    }

    // Validate that we got CSV-like content
    const lines = cleanedCSV.split('\n')
    if (lines.length < 2) {
      throw new Error('LLM response has insufficient rows (need at least header + 1 data row)')
    }

    const headerCols = lines[0].split(',').length
    if (headerCols < 2) {
      throw new Error('LLM response has insufficient columns (need at least 2)')
    }

    console.log(`[llmSecProcessor] LLM generated CSV: ${lines.length} rows, ${headerCols} cols`)

    return cleanedCSV
  } catch (err: any) {
    console.error('[llmSecProcessor] LLM conversion error:', err)
    throw new Error(`LLM conversion failed: ${err.message}`)
  }
}
