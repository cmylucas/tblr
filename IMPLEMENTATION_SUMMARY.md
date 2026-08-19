# Files/Datasets Tab Implementation Summary

Hackathon implementation notes from **TartanHacks 2026**. The [README](README.md) is the project overview.

## Overview
Files/Datasets tab with SEC EDGAR integration for the Electron (electron-vite) + React + TypeScript overlay app.

---

## What Was Built

### 1. **Dataset Storage Infrastructure** (`app/main/datasets/`)
- **datasetTypes.ts**: TypeScript types for dataset metadata and API responses
- **datasetStore.ts**: Persistent dataset storage with CRUD operations
  - Stores datasets in `userData/datasets/{datasetId}/` with `data.csv` + `metadata.json`
  - In-memory cache for fast access
  - Reuses existing CSV parsing utilities from `parseCsvTsv.ts`

### 2. **SEC EDGAR Integration** (`app/main/sec/`)
- **secClient.ts**: Rate-limited HTTP client (≤8 req/sec, 125ms between requests)
- **tickerResolver.ts**: CIK/ticker mapping with 24-hour cached `company_tickers.json`
- **cikExtractor.ts**: Extract CIK from PDF text (first 1-2 pages only, no table parsing)
  - Regex patterns for CIK, ticker symbol, and filename-based detection
- **csvFlattener.ts**: Flatten companyfacts XBRL JSON → CSV (facts-level rows)
  - Output columns: cik, entity_name, taxonomy, tag, label, unit, value, end_date, fiscal_year, fiscal_period, form, filed_date, accession_number
- **secProcessor.ts**: Orchestrate PDF → SEC → CSV conversion pipeline

### 3. **Dataset IPC Handlers** (`app/main/datasets/datasetsIpc.ts`)
- `datasets:openUploadDialog` - File dialog → CSV/TSV direct, PDF → SEC processing
- `datasets:promptTicker` - Retry PDF with user-provided ticker (if CIK detection fails)
- `datasets:list` - Return all datasets
- `datasets:getPreview` - Return preview (headers + sample rows)
- `datasets:readChunk` - Return row chunk with cursor
- `datasets:delete` - Delete dataset from disk + cache
- `datasets:importToSheets` - Import dataset to new sheet tab with formatting (bold header, freeze row 1, filter)

### 4. **LLM Dataset Tools** (`app/main/llm/datasetTools.ts`)
- `list_datasets()` - List all datasets with metadata
- `get_dataset_preview(dataset_id)` - Get headers + sample rows
- `read_dataset_chunk(dataset_id, cursor)` - Read rows by cursor (chunked for large datasets)
- `import_dataset_to_sheet(dataset_id, sheet_name)` - Import dataset to new sheet tab

### 5. **Main Process Integration**
- **ipc.ts**: Registered dataset IPC handlers (line 189-193)
- **main.ts**: Initialize dataset store on app startup (line 17)
- **preload.ts**: Exposed dataset APIs to renderer (lines 37-46)

### 6. **Files Tab UI Components** (`app/renderer/src/components/`)
- **FilesTab.tsx**: Main files tab with dataset list and upload button
- **DatasetListItem.tsx**: Dataset card with actions (Preview, Attach/Detach, Import, Delete)
- **DatasetPreviewModal.tsx**: Preview modal showing headers and sample rows
- **TickerInputModal.tsx**: Ticker input for failed CIK detection

### 7. **App-Level Integration**
- **App.tsx**: Added 'files' tab type, dataset state management, and tab navigation (lines 34, 56-57, 297-308, 350-359)
- **MessageInput.tsx**: Added dataset chips display with source icons and row counts (lines 92-113)

### 8. **Agent/LLM Integration**
- **agent.ts**: Replaced attachment tools with dataset tools
  - Updated `buildDatasetContext()` to list available datasets in system prompt
  - Route dataset tool calls to `executeDatasetTool()`

---

## Key Features

### Dataset Types Supported
1. **CSV/TSV Upload**: Direct upload, stored as-is
2. **SEC Filings (PDF)**: Auto-converted to CSV via SEC EDGAR APIs
   - Auto-detect CIK/ticker from PDF text or filename
   - Fallback to user input modal if detection fails
   - Fetch companyfacts XBRL and flatten to CSV

### SEC Processing Pipeline
1. Extract text from first 1-2 pages of PDF (no table parsing, only metadata extraction)
2. Try CIK/ticker detection via regex patterns
3. If not found, try ticker from filename (e.g., `AAPL_10K.pdf`)
4. If still not found, show ticker input modal
5. Fetch companyfacts XBRL from SEC API
6. Flatten all facts to CSV rows
7. Store as dataset with metadata

### Dataset Import to Sheets
- Creates new sheet tab
- Writes data in 5,000-row batches
- Applies formatting: bold header, freeze row 1, set filter, column width
- Naming convention: `Import_{datasetName}_{YYYYMMDD}`

### Chat Integration
- Datasets can be attached to chat (managed separately from old file attachments)
- LLM can use tools to read dataset chunks and import to sheets
- Dataset context included in system prompt for the LLM

---

## File Structure

```
app/
├── main/
│   ├── datasets/
│   │   ├── datasetTypes.ts          # TypeScript types
│   │   ├── datasetStore.ts          # CRUD operations + storage
│   │   └── datasetsIpc.ts           # IPC handlers
│   ├── sec/
│   │   ├── secClient.ts             # Rate-limited HTTP client
│   │   ├── tickerResolver.ts        # CIK/ticker mapping
│   │   ├── cikExtractor.ts          # Extract CIK from PDF
│   │   ├── csvFlattener.ts          # XBRL → CSV conversion
│   │   └── secProcessor.ts          # PDF → SEC → CSV pipeline
│   ├── llm/
│   │   ├── datasetTools.ts          # LLM tools for datasets
│   │   └── agent.ts                 # Updated to use dataset tools
│   ├── ipc.ts                       # Register dataset handlers
│   ├── main.ts                      # Initialize dataset store
│   └── preload.ts                   # Expose dataset APIs
└── renderer/
    └── src/
        ├── components/
        │   ├── FilesTab.tsx         # Main files tab component
        │   ├── DatasetListItem.tsx  # Dataset card component
        │   ├── DatasetPreviewModal.tsx # Preview modal
        │   ├── TickerInputModal.tsx # Ticker input modal
        │   └── MessageInput.tsx     # Updated with dataset chips
        └── App.tsx                  # Added files tab navigation
```

---

## How to Run

### Prerequisites
Ensure you have the following environment variable set (for SEC API compliance):
```bash
# Optional: SEC User-Agent email (already hardcoded in secClient.ts)
# SEC_USER_AGENT_EMAIL=your-email@example.com
```

### Development
```bash
cd "TartanHacks-2026"
npm run dev
```

### Build
```bash
npm run build
```

---

## Demo Checklist

### ✅ CSV Upload → Preview → Attach → Import
1. Go to **Files** tab
2. Click "**+ Upload Dataset**"
3. Select a CSV file
4. Dataset appears in list with row/column count
5. Click "**Preview**" → see headers and sample rows
6. Click "**Attach**" → dataset attached to chat (chip appears)
7. In chat, ask: "Create a summary tab with totals by category"
8. Or click "**Import to Sheets**" → creates new tab with formatted data

### ✅ TSV Upload
- Same as CSV, delimiter auto-detected

### ✅ SEC PDF → CSV Conversion
1. Go to **Files** tab
2. Upload an SEC 10-K/10-Q PDF (e.g., META_10K.pdf)
3. App auto-detects ticker/CIK from PDF text or filename
4. If detection fails, ticker input modal appears → enter ticker (e.g., `META`)
5. App fetches companyfacts XBRL from SEC API
6. Dataset appears as `SEC_{TICKER}_CompanyFacts.csv` (e.g., `SEC_META_CompanyFacts`)
7. Preview shows facts-level rows (taxonomy, tag, value, fiscal year, etc.)
8. Can attach to chat or import to sheets

### ✅ Chat with Datasets
1. Attach SEC dataset to chat (🏛️ chip appears)
2. Ask: "Pull Revenues and NetIncomeLoss for the last 3 fiscal years into a clean table"
3. LLM uses `read_dataset_chunk` to read data
4. LLM uses `import_dataset_to_sheet` to create a new sheet tab
5. LLM can also use existing sheet tools to format, pivot, chart, etc.

---

## Technical Notes

### Rate Limiting (SEC)
- Enforced at 8 req/sec (125ms between requests) to stay under SEC's 10 rps limit
- Implemented via token bucket in `secClient.ts`

### Caching (SEC)
- `company_tickers.json` cached in `userData/sec-cache/` for 24 hours
- Reduces redundant API calls during ticker resolution

### PDF Processing
- Uses `pdfjs-dist` to extract text from first 1-2 pages only
- **No table parsing** from PDF (only metadata extraction for CIK/ticker detection)
- All data comes from SEC EDGAR APIs (XBRL companyfacts)

### Dataset Storage
- Persistent: `userData/datasets/{datasetId}/data.csv` + `metadata.json`
- In-memory cache for fast access
- Metadata includes source type (upload vs sec-filing), stats (rows, cols), and SEC metadata (CIK, ticker, detection method)

### Error Handling
- CIK not found → Show ticker input modal
- SEC API failures → Display error to user in Files tab
- All SEC requests logged in audit log (operation: `dataset:sec-convert`)

---

## Acceptance Criteria

All requirements met:

- ✅ Files tab exists
- ✅ CSV/TSV upload works → preview → attach → import
- ✅ SEC PDF upload works → auto-detect CIK → fetch XBRL → convert to CSV → preview → import
- ✅ Import any dataset to Google Sheets creates formatted tab (bold header, freeze, filter)
- ✅ Chat agent can read datasets via tools and import/transform using Sheets tools
- ✅ Dataset list shows source (upload vs SEC), row/col count, and actions
- ✅ Preview modal shows headers and sample rows
- ✅ Ticker input modal appears if CIK detection fails
- ✅ Dataset state separate from old file attachments
- ✅ Build succeeds with no TypeScript errors

---

## Next Steps (Post-Hackathon)

### Optional Enhancements
1. **Summary CSV**: Generate a curated summary CSV with common tags (Revenues, NetIncomeLoss, Assets, etc.)
2. **Multi-file upload**: Allow uploading multiple files at once
3. **Dataset search/filter**: Add search bar to filter datasets by name or source
4. **Dataset tags**: Allow users to tag datasets for organization
5. **Export datasets**: Allow exporting datasets back to CSV/TSV files
6. **SEC filing metadata**: Show more SEC metadata (filing date, form type, etc.) in UI
7. **Progress indicators**: Show progress during SEC conversion (fetching tickers, fetching facts, etc.)
8. **Error recovery**: Allow retrying failed SEC conversions without re-uploading PDF

---

## Contact

For questions or issues, contact:
- **Email**: lucaschoi@cmu.edu
- **Project**: TartanHacks 2026 - tblr (Sheets Overlay)
