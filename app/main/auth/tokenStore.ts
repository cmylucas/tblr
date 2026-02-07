import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

// ── File-based token storage ──
// (keytar native bindings are unreliable across Electron ABI versions,
//  so we use a simple JSON file in the app data directory)

function tokenPath(): string {
  return path.join(app.getPath('userData'), 'tokens.json')
}

export async function saveTokens(tokens: Record<string, unknown>): Promise<void> {
  const json = JSON.stringify(tokens)
  const fp = tokenPath()
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  fs.writeFileSync(fp, json, { mode: 0o600 })
  console.log('[tokenStore] saved to', fp)
}

export async function loadTokens(): Promise<Record<string, unknown> | null> {
  const fp = tokenPath()
  if (fs.existsSync(fp)) {
    console.log('[tokenStore] loaded from', fp)
    return JSON.parse(fs.readFileSync(fp, 'utf-8'))
  }
  return null
}

export async function clearTokens(): Promise<void> {
  const fp = tokenPath()
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp)
  }
  console.log('[tokenStore] cleared')
}
