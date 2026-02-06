import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

function tokenPath(): string {
  return path.join(app.getPath('userData'), 'tokens.json')
}

export async function saveTokens(tokens: Record<string, unknown>): Promise<void> {
  const fp = tokenPath()
  fs.writeFileSync(fp, JSON.stringify(tokens), { mode: 0o600 })
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
