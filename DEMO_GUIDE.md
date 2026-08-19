# Demo Guide: Files/Datasets Tab with SEC EDGAR Integration

Internal notes from **TartanHacks 2026**. For setup and product overview, see [README.md](README.md).

## Quick Start

### 1. Setup Environment Variables

Make sure your `.env` file has the required credentials:

```bash
# Google OAuth credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# OpenRouter API key
OPENROUTER_API_KEY=sk-or-...
```

### 2. Run the App

```bash
npm run dev
```

The app will launch in overlay mode.

---

## Demo Script: End-to-End Testing

### Test 1: CSV Upload → Preview → Attach → Chat

**Goal**: Upload a CSV file, preview it, attach it to chat, and have the LLM analyze it.

1. **Open Files Tab**
   - Click the "Files" tab in the app (second tab)
   - You should see an empty state with "No datasets yet"

2. **Upload CSV**
   - Click "**+ Upload Dataset**" button
   - Select a CSV file (create a sample if needed):
     ```csv
     Category,Amount,Month
     Food,120.50,January
     Transport,45.30,January
     Food,98.20,February
     Rent,1200.00,January
     ```
   - Dataset appears in the list with row/column count

3. **Preview Dataset**
   - Click "**Preview**" button on the dataset card
   - Modal opens showing headers and first 20 rows
   - Verify row count and column count are correct
   - Close modal

4. **Attach to Chat**
   - Click "**Attach**" button on the dataset card
   - Button changes to "✓ Attached" (green)
   - Go to **Chat** tab
   - You should see a dataset chip above the input (📊 icon, dataset name, row count)

5. **Chat with Dataset**
   - Ask: "Create a summary showing total expenses by category"
   - LLM should:
     - Use `list_datasets` to see available datasets
     - Use `get_dataset_preview` to understand structure
     - Use `read_dataset_chunk` to read the data
     - Use `import_dataset_to_sheet` to create a new sheet
     - Or use other tools to create a pivot/summary

6. **Import Directly to Sheets**
   - Go back to **Files** tab
   - Click "**Import to Sheets**" on the dataset
   - Enter a sheet name (or use default)
   - New sheet tab created in your attached Google Sheet
   - Data appears with bold header, frozen row 1, and filter applied

---

### Test 2: TSV Upload

**Goal**: Verify TSV delimiter detection works.

1. Create a TSV file:
   ```tsv
   Name	Age	City
   Alice	30	NYC
   Bob	25	SF
   Charlie	35	LA
   ```

2. Upload via Files tab → "**+ Upload Dataset**"
3. Preview should show correct columns (delimiter auto-detected as TAB)
4. Attach and import should work same as CSV

---

### Test 3: SEC PDF → CSV Conversion (Auto-Detect)

**Goal**: Upload an SEC filing PDF and have it auto-convert to CSV via EDGAR APIs.

#### 3.1: Download an SEC Filing PDF

Option A - Use a real SEC filing:
1. Go to https://www.sec.gov/edgar/searchedgar/companysearch.html
2. Search for a company (e.g., "Meta Platforms")
3. Click on a recent 10-K or 10-Q filing
4. Download the PDF filing

Option B - Use a test PDF with CIK in the filename:
- Rename any PDF to `META_10K.pdf` or `AAPL_10Q.pdf`
- The app will detect the ticker from the filename

#### 3.2: Upload and Process

1. Go to **Files** tab
2. Click "**+ Upload Dataset**"
3. Select the SEC PDF file
4. **Wait for processing** (this may take 10-30 seconds):
   - App extracts text from first 1-2 pages
   - Tries to detect CIK via regex patterns
   - Falls back to ticker from filename (e.g., `META_10K.pdf`)
   - Fetches `company_tickers.json` from SEC (cached for 24 hours)
   - Resolves ticker → CIK
   - Fetches companyfacts XBRL from SEC API
   - Flattens all facts to CSV rows
   - Creates dataset

5. **Verify Dataset**
   - Dataset appears as `SEC_META_CompanyFacts` (or similar)
   - Source shows "SEC: META" (or the ticker/CIK)
   - Row count should be in the thousands (e.g., 5,000-50,000 fact observations)
   - Icon is 🏛️ (building emoji)

6. **Preview SEC Dataset**
   - Click "**Preview**"
   - Columns should include: cik, entity_name, taxonomy, tag, label, unit, value, end_date, fiscal_year, fiscal_period, form, filed_date, accession_number
   - Sample rows show individual fact observations

7. **Import to Sheets**
   - Click "**Import to Sheets**"
   - Large dataset will be written in 5,000-row batches
   - Verify data appears correctly in Google Sheets

8. **Chat with SEC Data**
   - Attach the SEC dataset to chat (🏛️ chip appears)
   - Ask: "Pull Revenues and NetIncomeLoss for the last 3 fiscal years and create a table"
   - LLM should:
     - Read chunks of the dataset
     - Filter for relevant tags (Revenues, NetIncomeLoss)
     - Group by fiscal year
     - Create a clean summary table

---

### Test 4: SEC PDF → CSV Conversion (Manual Ticker Input)

**Goal**: Test ticker input modal when CIK cannot be auto-detected.

1. Create or rename a PDF file without a ticker in the name (e.g., `test_filing.pdf`)
2. Make sure the PDF does NOT contain "CIK" or "Trading Symbol" text in the first page
3. Upload via Files tab → "**+ Upload Dataset**"
4. **Ticker input modal appears**:
   - Shows message: "Could not auto-detect the company ticker from test_filing.pdf"
   - Input field asks for ticker (e.g., AAPL, TSLA, META)
5. Enter a valid ticker (e.g., `AAPL`)
6. App processes same as Test 3.2 (steps 4-8)

---

### Test 5: Dataset Attachment/Detachment

**Goal**: Test attaching multiple datasets and detaching them.

1. Upload 2-3 datasets (mix of CSV and SEC)
2. Go to **Files** tab
3. Attach all datasets (click "**Attach**" on each)
4. Go to **Chat** tab
5. **Verify chips appear** for all attached datasets
6. Each chip should show:
   - Icon (📊 for uploaded, 🏛️ for SEC)
   - Dataset name
   - Row count
   - Remove button (×)
7. Click × on one chip → dataset detached
8. Go back to **Files** tab → verify that dataset shows "Attach" button again (not "✓ Attached")

---

### Test 6: Dataset Deletion

**Goal**: Delete a dataset and verify it's removed from disk.

1. Upload a test CSV
2. Click "**Delete**" button on the dataset card
3. Confirm dialog appears: "Delete dataset '[name]'?"
4. Click OK
5. Dataset removed from list
6. **Verify on disk**: Dataset folder deleted from `~/Library/Application Support/sheets-overlay/datasets/{datasetId}/`

---

### Test 7: LLM Dataset Tools

**Goal**: Test all 4 LLM tools for datasets.

1. Attach a dataset to chat
2. Test each tool via chat:

   **Tool 1: list_datasets**
   - Ask: "What datasets are available?"
   - LLM should list all datasets with IDs, names, row/col counts, and sources

   **Tool 2: get_dataset_preview**
   - Ask: "Show me a preview of the first dataset"
   - LLM should show headers and sample rows

   **Tool 3: read_dataset_chunk**
   - Ask: "Read the first 100 rows of the dataset"
   - LLM should read a chunk and show CSV text

   **Tool 4: import_dataset_to_sheet**
   - Ask: "Import the dataset into a new sheet called 'MyData'"
   - LLM should create a new sheet tab and write all data with formatting

---

### Test 8: Multi-Step Analysis with SEC Data

**Goal**: Complex analysis combining dataset reading, sheet creation, and formatting.

1. Upload an SEC filing PDF (e.g., META or AAPL)
2. Attach to chat
3. Ask a complex question:
   ```
   "Create a clean financial summary table with these metrics for the last 4 fiscal years:
   - Revenues
   - NetIncomeLoss
   - OperatingIncomeLoss
   - Assets
   - Liabilities

   Put it in a new sheet called 'Financial Summary' with proper formatting."
   ```

4. **Expected LLM behavior**:
   - Use `read_dataset_chunk` to read fact rows
   - Filter for relevant tags
   - Group by fiscal year
   - Calculate or select latest filed values
   - Use `import_dataset_to_sheet` OR use sheet write tools to create the table
   - Use formatting tools (bold header, freeze, etc.)

5. **Verify result**:
   - New sheet tab "Financial Summary" created
   - Table shows 4 rows (one per fiscal year) with 5 columns (metrics)
   - Header is bold and frozen
   - Values are correct

---

## Troubleshooting

### Issue: "CIK_NOT_FOUND" error without ticker modal

**Cause**: Error handling not triggering modal.

**Solution**: Check browser console for errors. Ensure `datasetsIpc.ts` is returning `{ ok: false, error: 'CIK_NOT_FOUND', data: { pdfPath, filename } }` correctly.

---

### Issue: SEC API rate limit errors

**Symptom**: Errors like "SEC API error: 429" or "Too Many Requests"

**Cause**: Exceeded 10 requests/second limit.

**Solution**: The app should already rate-limit to 8 req/sec. If this happens:
- Check `secClient.ts` rate limiting logic
- Clear SEC cache: `~/Library/Application Support/sheets-overlay/sec-cache/`
- Wait 1 minute and retry

---

### Issue: Dataset import fails with "No spreadsheet attached"

**Cause**: No Google Sheet attached to the app.

**Solution**:
1. Go to status bar
2. Click "Sign in with Google" if not signed in
3. Click "Attach Sheet"
4. Paste a Google Sheets URL
5. Try import again

---

### Issue: Dataset chips not appearing in chat

**Cause**: Dataset state not passed to MessageInput component.

**Solution**: Check `App.tsx` line 345 - ensure `attachedDatasets` prop is passed correctly:
```tsx
attachedDatasets={datasets.filter((d) => attachedDatasetIds.includes(d.datasetId))}
```

---

### Issue: Build fails with TypeScript errors

**Symptom**: `npm run build` shows errors.

**Solution**:
1. Run `npm run build` and check specific errors
2. Common issues:
   - Missing type imports
   - Incorrect function signatures
   - Missing required props
3. Check that all imports are correct:
   ```typescript
   import type { DatasetMeta } from '../../../main/datasets/datasetTypes'
   ```

---

## Performance Notes

### Large Datasets (100k+ rows)

- **CSV parsing**: Uses streaming parser, should handle large files
- **Preview**: Only shows first 20 rows (fast)
- **Import to Sheets**: Writes in 5,000-row batches (takes time but doesn't freeze)
- **LLM reading**: Uses chunked reading with cursors (prevents loading entire dataset into memory)

### SEC XBRL Processing

- Companyfacts JSON can be 2-20 MB (compressed)
- Flattening to CSV can produce 10k-100k rows
- First request for a company: ~10-30 seconds (fetch + process)
- Subsequent requests: Faster due to ticker cache (24-hour TTL)

---

## Next Steps

After verifying all tests pass:

1. **Polish UI**: Add loading spinners, better error messages
2. **Add metrics**: Track dataset usage, popular tickers
3. **Export feature**: Allow exporting datasets back to CSV
4. **Dataset search**: Add search/filter in Files tab
5. **Batch upload**: Support uploading multiple files at once

---

## Demo Talking Points (for Hackathon)

1. **Problem**: Financial analysts manually download SEC filings, copy-paste data into spreadsheets, and spend hours formatting.

2. **Solution**: One-click upload of SEC PDF → Auto-fetch structured XBRL data → Import to Google Sheets with formatting → Chat with LLM to analyze.

3. **Key Innovation**:
   - No manual table extraction from PDFs (use official SEC APIs instead)
   - Auto-detect company from PDF text or filename
   - Store as persistent datasets for reuse
   - LLM can read and analyze via tools

4. **Live Demo Flow**:
   - Upload META 10-K PDF
   - Show auto-detection: "SEC_META_CompanyFacts" dataset created
   - Preview: 40,000+ fact observations
   - Chat: "Create a 3-year revenue trend chart"
   - Result: Clean table + chart in Google Sheets

5. **Impact**: Save 2-3 hours per analysis session for financial analysts.

---

## Contact

Questions or issues? Contact **lucaschoi@cmu.edu**
