import { OAuth2Client } from 'google-auth-library'
import { shell } from 'electron'
import * as http from 'http'
import * as net from 'net'
import { saveTokens, loadTokens, clearTokens } from './tokenStore'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file', // Create/manage own Drive files
  'https://www.googleapis.com/auth/drive.metadata.readonly', // Read Drive metadata
]

let oauth2: OAuth2Client | null = null
let userEmail: string | undefined

function getBasePort(): number {
  return parseInt(process.env.GOOGLE_REDIRECT_PORT || '8401', 10)
}

function createClient(port: number): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env')
  }
  return new OAuth2Client(clientId, clientSecret, `http://127.0.0.1:${port}/callback`)
}

export function getOAuth2Client(): OAuth2Client {
  if (!oauth2) {
    oauth2 = createClient(getBasePort())
  }
  return oauth2
}

export async function tryRestoreSession(): Promise<boolean> {
  try {
    const tokens = await loadTokens()
    if (!tokens) return false
    const client = getOAuth2Client()
    client.setCredentials(tokens as any)
    if (tokens.refresh_token) {
      const { credentials } = await client.refreshAccessToken()
      client.setCredentials(credentials)
      await saveTokens(credentials as Record<string, unknown>)
    }
    await fetchEmail(client)
    console.log('[googleAuth] session restored for', userEmail)
    return true
  } catch (err) {
    console.log('[googleAuth] session restore failed:', err)
    await clearTokens()
    return false
  }
}

export async function signIn(): Promise<string | undefined> {
  // Find an available port (try base port, then base+1 .. base+4)
  const basePort = getBasePort()
  const port = await findAvailablePort(basePort, 5)

  // Create a client with the actual port we'll listen on
  const client = createClient(port)
  oauth2 = client

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })

  // Open in system browser
  await shell.openExternal(authUrl)

  // Start local callback server
  const code = await waitForAuthCode(port)

  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  await saveTokens(tokens as Record<string, unknown>)
  await fetchEmail(client)
  console.log('[googleAuth] signed in as', userEmail)
  return userEmail
}

export async function signOut(): Promise<void> {
  await clearTokens()
  oauth2 = null
  userEmail = undefined
  console.log('[googleAuth] signed out')
}

export function getEmail(): string | undefined {
  return userEmail
}

export function isSignedIn(): boolean {
  try {
    const client = getOAuth2Client()
    return !!client.credentials?.access_token
  } catch {
    return false
  }
}

export function isConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

async function fetchEmail(client: OAuth2Client): Promise<void> {
  try {
    const res = await client.request<{ email: string }>({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    })
    userEmail = res.data.email
  } catch {
    userEmail = undefined
  }
}

/** Try ports in [base, base+range) and return the first available one. */
function findAvailablePort(base: number, range: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let tried = 0
    function tryPort(port: number): void {
      const srv = net.createServer()
      srv.once('error', () => {
        tried++
        if (tried < range) {
          tryPort(base + tried)
        } else {
          reject(new Error(`No available port in range ${base}-${base + range - 1}`))
        }
      })
      srv.once('listening', () => {
        srv.close(() => resolve(port))
      })
      srv.listen(port, '127.0.0.1')
    }
    tryPort(base)
  })
}

function waitForAuthCode(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://127.0.0.1:${port}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<h2>Authentication failed</h2><p>You can close this window.</p>')
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h2>Authentication successful!</h2><p>You can close this window and return to Sheets Overlay.</p>')
        server.close()
        resolve(code)
        return
      }

      res.writeHead(404)
      res.end()
    })

    server.on('error', (err: any) => {
      reject(new Error(`OAuth callback server failed to start: ${err.message}`))
    })

    server.listen(port, '127.0.0.1', () => {
      console.log(`[googleAuth] callback server listening on http://127.0.0.1:${port}/callback`)
    })

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth timeout — no code received within 2 minutes'))
    }, 120_000)
  })
}
