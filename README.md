# Sheets Overlay with AI Budget Intelligence

A desktop overlay for Google Sheets — always-on-top, translucent, frameless. Attach a sheet by URL, authenticate via Google OAuth, then read/write ranges directly from the overlay.

**Supports macOS and Windows.**

**✨ NEW: AI-Powered Budget Intelligence** — Analyze spending patterns, detect anomalies, get personalized budget recommendations, and predict future expenses using AI (powered by Dedalus Labs).

## Prerequisites

- Node.js >= 18
- Google Chrome (overlay auto-shows when Chrome has a Google Sheets tab active)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy .env.example to .env and fill in your credentials
cp .env.example .env
# Edit .env with your GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and DEDALUS_API_KEY

# 3. Run in development mode
npm run dev       # macOS (unsets ELECTRON_RUN_AS_NODE automatically)
npm run dev:win   # Windows
```

**VS Code users:** VS Code sets `ELECTRON_RUN_AS_NODE=1` in its terminal, which breaks Electron. The `dev` script unsets it on macOS; use `dev:win` on Windows (which clears it via `set ELECTRON_RUN_AS_NODE=`).

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Google Sheets API** (APIs & Services > Library)
4. Configure the **OAuth consent screen**:
   - Choose **External** (or Internal for Workspace orgs)
   - Add scope: `https://www.googleapis.com/auth/spreadsheets`
   - Add your email as a **test user**
5. Create **OAuth 2.0 Client ID** (APIs & Services > Credentials):
   - Application type: **Desktop app** (or **Web application**)
   - If Web application: add `http://127.0.0.1:8401/callback` to **Authorized redirect URIs**
6. Paste credentials into `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_PORT=8401
   ```

## Dedalus Labs Setup (AI Features)

To use the AI Budget Intelligence features, you need a Dedalus Labs API key:

1. Visit [Dedalus Labs](https://www.dedaluslabs.ai/)
2. Sign up for an account
3. Navigate to the **API Keys** section in your dashboard
4. Click **Create New API Key**
5. Copy the API key (starts with `dd_...`)
6. Add to your `.env` file:
   ```
   DEDALUS_API_KEY=dd_your_actual_api_key_here
   DEDALUS_MODEL=anthropic/claude-sonnet-4.5
   ```

**Note:** The AI features are optional. The app will work without a Dedalus API key, but AI Budget Intelligence features will be disabled.

## Usage

1. **Launch the app** with `npm run dev`
2. The overlay window appears in the top-right of your screen
3. **Sign in** — click "Sign in with Google" (opens your browser for OAuth)
4. **Attach a sheet** — paste a Google Sheets URL and click "Attach"
5. **AI Budget Analysis** (NEW):
   - Enter your financial data range (e.g., `Sheet1!A2:E100`)
   - Map columns to financial fields (Date, Amount, Category, Description)
   - Click "Preview Data" to verify parsing
   - Click "Analyze with AI 🤖" to get insights
   - View spending analysis, anomalies, and personalized recommendations
6. **Read data** — enter an A1 range (e.g. `Sheet1!A1:D10`) and click "Read"
7. **Write data** — enter a range, paste TSV/CSV data, and click "Write"
8. The **Audit Log** shows the last 20 operations (including AI analyses)

### Sample Financial Data Format

For AI Budget Intelligence to work, your Google Sheet should have financial transaction data in this format:

| Date       | Category      | Amount | Description           |
|------------|---------------|--------|-----------------------|
| 2024-01-15 | Groceries     | 45.67  | Whole Foods          |
| 2024-01-16 | Dining        | 32.50  | Restaurant lunch     |
| 2024-01-17 | Transport     | 52.00  | Gas station          |
| 2024-01-18 | Entertainment | 15.99  | Netflix subscription |
| 2024-01-20 | Groceries     | 78.23  | Trader Joe's         |

**Tips for best results:**
- Use at least 20-50 transactions for meaningful analysis
- Include 2-3 months of data for trend detection
- Supported date formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD-MM-YYYY`, `DD/MM/YYYY`
- Amount should be numeric (currency symbols like `$` are automatically removed)
- Categories help the AI provide better insights (Groceries, Dining, Transport, Entertainment, Housing, Utilities, etc.)
- Description column is optional but helps with context

### Overlay Behavior

- **Auto-shows** when Google Chrome is active with a Google Sheets tab
- **Auto-hides** when you switch away from Chrome or to a non-Sheets tab
- **Global hotkey:** `Cmd+Shift+Space` (macOS) / `Ctrl+Shift+Space` (Windows)

### macOS Permissions

macOS may request **Accessibility** permissions for the window watcher (AppleScript). Grant this in **System Settings > Privacy & Security > Accessibility**.

### Windows Notes

- Window detection uses PowerShell to read the foreground window. No special permissions needed.
- If `keytar` fails to install (requires C++ build tools), token storage falls back to a JSON file in the app data directory. This is fine for development.
- Windows Firewall may prompt for the OAuth callback server on `127.0.0.1:8401` — allow it.

## Architecture

```
app/
  main/                          # Electron main process
    main.ts                      # Entry point
    ipc.ts                       # IPC handlers (Sheets/auth/AI logic)
    windowManager.ts             # Overlay window creation, hotkey
    windowWatcher.ts             # Active window polling (osascript)
    auth/
      googleAuth.ts              # OAuth2 flow + token management
      tokenStore.ts              # Token persistence (file-based)
    sheets/
      sheetsClient.ts            # Google Sheets API wrappers
      parseSheetUrl.ts           # URL parsing for spreadsheetId/gid
    ai/                          # NEW: AI Budget Intelligence
      dedalusClient.ts           # Dedalus Labs SDK wrapper
      financialParser.ts         # Parse spreadsheet → transactions
      dataAggregator.ts          # Privacy-safe data aggregation
      insightsCache.ts           # Cache AI responses (1hr TTL)
      promptTemplates.ts         # Prompt engineering for analysis
    shared/
      types.ts                   # IPC channel names, domain types
      schema.ts                  # Zod validation schemas
    preload.ts                   # contextBridge for renderer
  renderer/
    index.html
    src/
      main.tsx                   # React entry
      App.tsx                    # Root component
      components/
        OverlayShell.tsx         # Outer shell with drag handle + status badges
        AuthPanel.tsx            # Sign in / sign out
        AttachSheet.tsx          # Paste URL, attach
        FinancialDataConfig.tsx  # NEW: AI column mapping & preview
        BudgetInsights.tsx       # NEW: AI insights display
        ReadRange.tsx            # Read A1 range + display table
        WriteRange.tsx           # Write TSV/CSV to range
        AuditLog.tsx             # Last 20 operations
```

### Platform-Specific Code

- **Renderer never calls Google APIs directly.** All API calls go through IPC (`contextBridge` + `ipcRenderer.invoke`).
- **Window detection uses `osascript`** (AppleScript) instead of native Node addons, avoiding ABI compatibility issues with Electron's bundled Node.
- **Token storage** uses a JSON file in `app.getPath('userData')` with `0o600` permissions.
- **All IPC inputs** are validated with Zod schemas.
- **Privacy-first AI:** Only aggregated spending summaries are sent to Dedalus AI (no raw transaction details, merchant names, or descriptions).
- **Smart caching:** AI insights cached for 1 hour to reduce API costs and improve performance.
- **Multiple date formats:** Supports YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, and DD/MM/YYYY formats.

## AI Budget Intelligence Features

### What It Does

The AI Budget Intelligence feature analyzes your financial data from Google Sheets and provides:

- 📊 **Spending Analysis:** Total spending, averages, and trend detection (up/down/stable)
- 🏷️ **Category Breakdown:** Spending by category with AI-recommended budgets
- ⚠️ **Anomaly Detection:** Identifies unusual transactions with explanations
- 💡 **Personalized Recommendations:** Actionable advice to reduce spending and meet savings goals
- 🎯 **Budget Status:** Visual indicators (green/yellow/red) for each category

### Privacy & Security

- **Only aggregated data is sent to AI:** Category totals, averages, and counts — never raw transaction details
- **No sensitive data shared:** Merchant names and descriptions stay local
- **You control the data:** AI features are opt-in and can be skipped
- **Cached results:** Analysis results cached locally for 1 hour to minimize API calls

### Example Use Case

1. Create a Google Sheet with your transactions (Date, Category, Amount, Description)
2. Add 2-3 months of spending data (groceries, dining, transport, etc.)
3. Attach the sheet in the overlay
4. Use the "AI Budget Intelligence" section to analyze your spending
5. Get insights like:
   - "Your dining expenses increased 20% this month"
   - "⚠️ Unusual transaction detected: $500 in Entertainment (your average is $50)"
   - "💡 Reduce dining by $150/month to meet your savings goal"
All OS-specific logic lives in `app/main/platform/`:

| Concern | macOS | Windows |
|---------|-------|---------|
| Window detection | AppleScript (`osascript`) | PowerShell (Win32 API) |
| Chrome app name | `Google Chrome` | `chrome` / `chrome.exe` |
| Overlay options | `vibrancy`, `visibleOnAllWorkspaces` | `backgroundColor: #00000000` |
| Always-on-top level | `floating` | boolean `true` |
| Hotkey | `Cmd+Shift+Space` | `Ctrl+Shift+Space` |
| Token storage | keytar (Keychain) or JSON file | keytar (Credential Manager) or JSON file |

- macOS only (osascript-based window detection) — **Note:** App should also work on Windows/Linux but auto-show/hide won't function
- Chrome only (other browsers not detected)
- Attach-by-URL only (no automatic detection of the active spreadsheet)
- No selection detection from the browser
- No undo/redo for writes
- Token stored in plaintext JSON (not Keychain) — acceptable for MVP
- AI features require a Dedalus Labs API key (free tier available)
## Packaging

```bash
npm run pack:mac   # Build + package for macOS (.dmg)
npm run pack:win   # Build + package for Windows (.exe via NSIS)
npm run pack       # Build + package for current platform
```

No code signing is configured. macOS will show Gatekeeper warnings; Windows will show SmartScreen warnings. This is expected for development builds.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev mode (macOS) |
| `npm run dev:win` | Dev mode (Windows) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Troubleshooting

### "Dedalus API key not configured" error

Make sure you have:
1. Created a `.env` file (copy from `.env.example`)
2. Added your Dedalus API key: `DEDALUS_API_KEY=dd_your_key_here`
3. Restarted the app after adding the key

### "Failed to parse data" error

Check that:
- Your date column contains valid dates in a supported format
- Your amount column contains numeric values (currency symbols are OK)
- You've selected the correct column numbers (0-indexed: A=0, B=1, C=2, etc.)
- You're not including the header row in your range (use `Sheet1!A2:D100` instead of `Sheet1!A1:D100`)

### AI analysis is slow

- First analysis takes 3-5 seconds (normal)
- Subsequent analyses use cached results (instant)
- Cache invalidates after 1 hour or when data changes

### Window detection not working on Mac

Grant Accessibility permissions:
1. System Settings → Privacy & Security → Accessibility
2. Add/enable the app (Electron or your terminal)
3. Restart the app

### Testing on Windows/Linux

The app should run on Windows/Linux but:
- Auto-show/hide feature won't work (macOS-only)
- Use the global hotkey (`Cmd+Shift+Space` on Mac, check `windowManager.ts` for Windows/Linux key)
- All other features (Google Sheets, AI analysis) work normally

## Project Info

Built for **TartanHacks 2026** 🎉

### Tech Stack

- **Electron** 28.3.3 - Desktop app framework
- **React** 18.3.1 - UI components
- **TypeScript** 5.7.2 - Type safety
- **Google Sheets API** - Spreadsheet integration
- **Dedalus Labs** - AI/LLM gateway (Claude Sonnet 4.5)
- **Zod** - Runtime validation

### Future Enhancements (Phases 5-7)

Planned features not yet implemented:
- 📈 **Spending Trends Visualization:** Charts showing monthly spending patterns
- 🔮 **Predictive Analytics:** Forecast future spending based on historical data, weather, and economic indicators
- 📝 **Budget Planner:** Interactive budget creation with AI suggestions and export to Sheets
- 🌤️ **Weather Integration:** Correlate spending patterns with weather data
- 💬 **Natural Language Queries:** Ask questions like "How much did I spend on groceries last month?"

### License

MIT

### Acknowledgments

- Google Sheets API for spreadsheet access
- Dedalus Labs for AI infrastructure
- Anthropic Claude for financial analysis
| `npm run pack:mac` | Package macOS .dmg |
| `npm run pack:win` | Package Windows .exe |
| `npm run pack` | Package for current OS |

## Known Limitations

- Chrome only (other browsers not detected)
- Attach-by-URL only (no automatic spreadsheet detection from browser)
- No selection detection from the browser
- No undo/redo for writes
- Token stored in plaintext JSON when keytar unavailable
