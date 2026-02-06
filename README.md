# Sheets Overlay

A macOS desktop overlay for Google Sheets — always-on-top, translucent, frameless. Attach a sheet by URL, authenticate via Google OAuth, then read/write ranges directly from the overlay.

## Prerequisites

- macOS (only platform supported)
- Node.js >= 18
- Google Chrome (overlay auto-shows when Chrome has a Google Sheets tab active)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy .env.example to .env and fill in your Google OAuth credentials
cp .env.example .env
# Edit .env with your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

# 3. Run in development mode
npm run dev
```

**Important:** If running from VS Code's integrated terminal, the `npm run dev` script automatically unsets `ELECTRON_RUN_AS_NODE` (which VS Code sets). If you run from an external terminal, this is not needed.

## Google Cloud Console Setup

To use OAuth sign-in and Sheets API, you need to create OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Google Sheets API**:
   - Navigate to **APIs & Services > Library**
   - Search for "Google Sheets API" and click **Enable**
4. Configure the **OAuth consent screen**:
   - Go to **APIs & Services > OAuth consent screen**
   - Choose **External** (or Internal if using a Workspace org)
   - Fill in app name, support email, etc.
   - Add scope: `https://www.googleapis.com/auth/spreadsheets`
   - Add your email as a test user (required for External apps in testing mode)
5. Create **OAuth 2.0 Client ID**:
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth client ID**
   - Application type: **Desktop app** (or **Web application**)
   - If Web application: add `http://127.0.0.1:8401/callback` to **Authorized redirect URIs**
   - Download or copy the **Client ID** and **Client secret**
6. Paste the values into your `.env` file:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_PORT=8401
   ```

## Usage

1. **Launch the app** with `npm run dev`
2. The overlay window appears in the top-right of your screen
3. **Sign in** — click "Sign in with Google" (opens your browser for OAuth)
4. **Attach a sheet** — paste a Google Sheets URL and click "Attach"
5. **Read data** — enter an A1 range (e.g. `Sheet1!A1:D10`) and click "Read"
6. **Write data** — enter a range, paste TSV/CSV data, and click "Write"
7. The **Audit Log** shows the last 20 operations

### Overlay Behavior

- The overlay **auto-shows** when Google Chrome is the active app and the window title contains "Sheets"
- The overlay **auto-hides** when you switch away from Chrome or to a non-Sheets tab
- **Global hotkey:** `Cmd+Shift+Space` toggles the overlay manually

### macOS Permissions

On first run, macOS may ask for **Accessibility** permissions (needed for the window watcher to detect the active app via AppleScript). Grant this in **System Settings > Privacy & Security > Accessibility**.

## Architecture

```
app/
  main/                    # Electron main process
    main.ts                # Entry point
    ipc.ts                 # IPC handlers (all Sheets/auth logic)
    windowManager.ts       # Overlay window creation, hotkey
    windowWatcher.ts       # Active window polling (osascript)
    auth/
      googleAuth.ts        # OAuth2 flow + token management
      tokenStore.ts        # Token persistence (file-based)
    sheets/
      sheetsClient.ts      # Google Sheets API wrappers
      parseSheetUrl.ts     # URL parsing for spreadsheetId/gid
    shared/
      types.ts             # IPC channel names, domain types
      schema.ts            # Zod validation schemas
    preload.ts             # contextBridge for renderer
  renderer/
    index.html
    src/
      main.tsx             # React entry
      App.tsx              # Root component
      components/
        OverlayShell.tsx   # Outer shell with drag handle + status badges
        AuthPanel.tsx      # Sign in / sign out
        AttachSheet.tsx    # Paste URL, attach
        ReadRange.tsx      # Read A1 range + display table
        WriteRange.tsx     # Write TSV/CSV to range
        AuditLog.tsx       # Last 20 operations
```

### Key Design Decisions

- **Renderer never calls Google APIs directly.** All API calls go through IPC (`contextBridge` + `ipcRenderer.invoke`).
- **Window detection uses `osascript`** (AppleScript) instead of native Node addons, avoiding ABI compatibility issues with Electron's bundled Node.
- **Token storage** uses a JSON file in `app.getPath('userData')` with `0o600` permissions.
- **All IPC inputs** are validated with Zod schemas.

## Known Limitations

- macOS only (osascript-based window detection)
- Chrome only (other browsers not detected)
- Attach-by-URL only (no automatic detection of the active spreadsheet)
- No selection detection from the browser
- No undo/redo for writes
- Token stored in plaintext JSON (not Keychain) — acceptable for MVP

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
