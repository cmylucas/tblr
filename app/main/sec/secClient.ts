/**
 * Rate-limited HTTP client for SEC EDGAR APIs.
 * Enforces SEC's rate limit guidance of ≤10 requests/second.
 * We use 8 req/sec (125ms between requests) to stay safely under the limit.
 */
export class SecClient {
  private lastRequestTime = 0
  private readonly MIN_INTERVAL_MS = 125 // 8 req/sec

  async fetch(url: string): Promise<any> {
    await this.enforceRateLimit()

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Sheets Overlay TartanHacks lucaschoi@cmu.edu',
        'Accept-Encoding': 'gzip, deflate',
      },
    })

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  private async enforceRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime
    if (elapsed < this.MIN_INTERVAL_MS) {
      const delay = this.MIN_INTERVAL_MS - elapsed
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    this.lastRequestTime = Date.now()
  }
}
