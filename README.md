# tblr

Always-on-top overlay for Google Sheets. Sign in with Google, attach a spreadsheet by URL, then chat with an LLM that can read and write the sheet, import datasets, and pull structured company data from SEC EDGAR.

Built at **[TartanHacks 2026](https://www.tartanhacks.com/)** (theme: Mosaic) as a 24-hour prototype. macOS and Windows.

The name is a nod to tables — a desktop layer over the spreadsheet you already have open.

## What it does

- **Overlay** — frameless, translucent window that auto-shows when Chrome is on a Google Sheets tab
- **Sheets API** — attach a sheet by URL; read/write ranges; audit log of recent operations
- **Chat agent** — OpenRouter-backed LLM with tools for sheets (ranges, formatting, charts, pivots, filters)
- **Datasets** — upload CSV/TSV, or drop a 10-K PDF and fetch official XBRL companyfacts from SEC EDGAR instead of scraping tables
- **Import** — write a dataset into a new sheet tab with header formatting, freeze, and filter

Typical demo: upload a 10-K PDF → auto-detect ticker/CIK → store ~tens of thousands of fact rows → ask the agent to build a revenue trend in the attached spreadsheet.

## Prerequisites

- Node.js >= 18
- Google Chrome (window detection is Chrome-only)
- Google Cloud OAuth credentials (Sheets API)
- OpenRouter API key

## Quick start

```bash
npm install
cp .env.example .env   # then fill in credentials
npm run dev            # macOS
npm run dev:win        # Windows
```

VS Code sets `ELECTRON_RUN_AS_NODE=1`, which breaks Electron. The `dev` / `dev:win` scripts clear it.

### `.env`

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_PORT=8401
OPENROUTER_API_KEY=your-openrouter-key
```

Do not commit `.env`. `.env.example` is the template.

### Google Cloud Console

1. Create a project at [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Sheets API**
3. Configure the OAuth consent screen (External is fine). Add scope `https://www.googleapis.com/auth/spreadsheets` and your email as a test user
4. Create an OAuth client (Desktop app, or Web application with redirect `http://127.0.0.1:8401/callback`)
5. Paste the client ID and secret into `.env`

OpenRouter keys: [openrouter.ai/keys](https://openrouter.ai/keys)

## Usage

1. Launch with `npm run dev` (or `dev:win`)
2. Overlay appears top-right
3. **Sign in** — browser OAuth
4. **Attach** a Google Sheets URL
5. **Chat** — ask for summaries, new tabs, charts, or imports
6. **Files** — upload CSV/TSV or SEC PDFs; preview, attach to chat, or import to the sheet
7. **Logs** — last 20 operations

**Hotkey:** `Cmd+Shift+Space` (macOS) / `Ctrl+Shift+Space` (Windows)

**macOS:** grant Accessibility for the AppleScript window watcher (System Settings → Privacy & Security → Accessibility).

**Windows:** foreground-window detection uses PowerShell. If `keytar` fails to install (needs C++ build tools), OAuth tokens fall back to a JSON file in the app data directory.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev mode (macOS) |
| `npm run dev:win` | Dev mode (Windows) |
| `npm run build` | Production build |
| `npm run pack:mac` | Package `.dmg` |
| `npm run pack:win` | Package `.exe` (NSIS) |
| `npm run pack` | Package for the current OS |

No code signing. Gatekeeper / SmartScreen warnings are expected.

## Architecture (short)

Electron main process (TypeScript) + React overlay. OS-specific window detection lives in `app/main/platform/`. Google OAuth and Sheets live in `app/main/auth/` and `app/main/sheets/`. The agent and tools are in `app/main/llm/`. Datasets and SEC EDGAR are in `app/main/datasets/` and `app/main/sec/`.

Hackathon-era notes: [DEMO_GUIDE.md](DEMO_GUIDE.md), [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md).

## Known limitations

- Chrome only
- Attach-by-URL (no automatic spreadsheet detection from the tab)
- No undo/redo for writes
- Tokens stored as plaintext JSON when keytar is unavailable
- Hackathon prototype — expect rough edges
