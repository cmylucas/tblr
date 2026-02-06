# Sheets Overlay

A desktop overlay for Google Sheets — always-on-top, translucent, frameless. Attach a sheet by URL, authenticate via Google OAuth, then read/write ranges directly from the overlay.

**Supports macOS and Windows.**

## Prerequisites

- Node.js >= 18
- Google Chrome (overlay auto-shows when Chrome has a Google Sheets tab active)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy .env.example to .env and fill in your Google OAuth credentials
cp .env.example .env   # macOS/Linux
# copy .env.example .env   # Windows cmd

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

## Usage

1. **Launch** with `npm run dev` (macOS) or `npm run dev:win` (Windows)
2. The overlay appears in the top-right of your screen
3. **Sign in** — opens your browser for Google OAuth
4. **Attach a sheet** — paste a Google Sheets URL
5. **Read** — enter an A1 range (e.g. `Sheet1!A1:D10`)
6. **Write** — enter a range + paste TSV/CSV data
7. **Audit Log** shows the last 20 operations

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
  main/
    main.ts                # Entry point
    ipc.ts                 # IPC handlers
    windowManager.ts       # Overlay window + hotkey
    windowWatcher.ts       # Active window polling
    platform/              # Cross-platform abstraction
      index.ts             # Re-exports
      os.ts                # isMac, isWindows helpers
      hotkeys.ts           # Platform-specific accelerators
      windowRules.ts       # Active window detection (osascript / PowerShell)
      overlayOptions.ts    # BrowserWindow options per OS
    auth/
      googleAuth.ts        # OAuth2 flow + token management
      tokenStore.ts        # keytar (optional) + JSON file fallback
    sheets/
      sheetsClient.ts      # Google Sheets API wrappers
      parseSheetUrl.ts     # URL parsing
    shared/
      types.ts             # IPC types
      schema.ts            # Zod schemas
    preload.ts             # contextBridge
  renderer/
    index.html
    src/
      main.tsx
      App.tsx
      components/          # OverlayShell, AuthPanel, AttachSheet, etc.
```

### Platform-Specific Code

All OS-specific logic lives in `app/main/platform/`:

| Concern | macOS | Windows |
|---------|-------|---------|
| Window detection | AppleScript (`osascript`) | PowerShell (Win32 API) |
| Chrome app name | `Google Chrome` | `chrome` / `chrome.exe` |
| Overlay options | `vibrancy`, `visibleOnAllWorkspaces` | `backgroundColor: #00000000` |
| Always-on-top level | `floating` | boolean `true` |
| Hotkey | `Cmd+Shift+Space` | `Ctrl+Shift+Space` |
| Token storage | keytar (Keychain) or JSON file | keytar (Credential Manager) or JSON file |

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
| `npm run pack:mac` | Package macOS .dmg |
| `npm run pack:win` | Package Windows .exe |
| `npm run pack` | Package for current OS |

## Known Limitations

- Chrome only (other browsers not detected)
- Attach-by-URL only (no automatic spreadsheet detection from browser)
- No selection detection from the browser
- No undo/redo for writes
- Token stored in plaintext JSON when keytar unavailable
