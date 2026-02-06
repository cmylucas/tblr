import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
const SERVICE = 'sheets-overlay'
const ACCOUNT = 'google-oauth-tokens'

// ── Keytar (optional native keychain) ──

let keytarModule: typeof import('keytar') | null | false = null // null=untried, false=unavailable

async function tryKeytar(): Promise<typeof import('keytar') | null> {
  if (keytarModule === false) return null
  if (keytarModule) return keytarModule
  try {
    const kt = await import('keytar')
    // Smoke-test: actually call getPassword to verify native binding works.
    // If the ABI mismatches, the wrapper exists but the call throws.
    await kt.getPassword(SERVICE, '__probe__')
    keytarModule = kt
    console.log('[tokenStore] keytar available — using system keychain')
    return keytarModule
  } catch (err: any) {
    keytarModule = false
    console.log('[tokenStore] keytar unavailable — using file fallback:', err.message)
    return null
  }
}

// ── File fallback ──

function tokenPath(): string {
  return path.join(app.getPath('userData'), 'tokens.json')
}

// ── Public API ──

export async function saveTokens(tokens: Record<string, unknown>): Promise<void> {
  const json = JSON.stringify(tokens)

  const kt = await tryKeytar()
  if (kt) {
    await kt.setPassword(SERVICE, ACCOUNT, json)
    console.log('[tokenStore] saved to keychain')
    return
  }

  const fp = tokenPath()
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  // 0o600 only meaningful on unix; Windows ignores it but doesn't error
  fs.writeFileSync(fp, json, { mode: 0o600 })
  console.log('[tokenStore] saved to', fp)
}

export async function loadTokens(): Promise<Record<string, unknown> | null> {
  const kt = await tryKeytar()
  if (kt) {
    const raw = await kt.getPassword(SERVICE, ACCOUNT)
    if (raw) {
      console.log('[tokenStore] loaded from keychain')
      return JSON.parse(raw)
    }
  }

  const fp = tokenPath()
  if (fs.existsSync(fp)) {
    console.log('[tokenStore] loaded from', fp)
    return JSON.parse(fs.readFileSync(fp, 'utf-8'))
  }
  return null
}

export async function clearTokens(): Promise<void> {
  const kt = await tryKeytar()
  if (kt) {
    try { await kt.deletePassword(SERVICE, ACCOUNT) } catch { /* ignore */ }
  }
  const fp = tokenPath()
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp)
  }
  console.log('[tokenStore] cleared')
}
