/**
 * Dedalus Client
 * Wrapper for Dedalus Labs SDK - handles all LLM communication
 */

import Dedalus from 'dedalus-labs'
import type { SpendingSummary } from './dataAggregator'
import { PROMPTS } from './promptTemplates'

export interface BudgetInsight {
  category: string
  currentSpending: number
  recommendedBudget: number
  reasoning: string
  priority: 'high' | 'medium' | 'low'
}

export interface Anomaly {
  category: string
  amount: number
  date: string
  reason: string
}

export interface Recommendation {
  category: string
  action: string
  expectedSavings: number
  priority: 'high' | 'medium' | 'low'
}

export interface AnalysisResponse {
  insights: BudgetInsight[]
  anomalies: Anomaly[]
  summary: {
    totalSpending: number
    trend: 'up' | 'down' | 'stable'
    trendPercent: number
  }
  recommendations: Recommendation[]
}

class DedalusClient {
  private client: Dedalus
  private model: string

  constructor(apiKey: string, model?: string) {
    this.client = new Dedalus({ apiKey })
    this.model = model || 'anthropic/claude-sonnet-4.5'
  }

  /**
   * Analyze spending summary and get AI insights
   */
  async analyzeSpendingSummary(
    summary: SpendingSummary,
    context?: string
  ): Promise<AnalysisResponse> {
    try {
      const prompt = PROMPTS.ANALYZE_SPENDING(summary, context)

      console.log('[dedalus] Analyzing spending data...')

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from AI')
      }

      const result = JSON.parse(content)

      console.log('[dedalus] Analysis complete')

      return {
        insights: result.insights || [],
        anomalies: result.anomalies || [],
        summary: result.summary || {
          totalSpending: summary.totalSpending,
          trend: 'stable',
          trendPercent: 0,
        },
        recommendations: result.recommendations || [],
      }
    } catch (err: any) {
      console.error('[dedalus] Analysis failed:', err.message)
      throw new Error(`AI analysis failed: ${err.message}`)
    }
  }

  /**
   * Test connection to Dedalus API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test. Please respond with "OK".',
          },
        ],
        max_tokens: 10,
      })

      return response.choices[0]?.message?.content?.includes('OK') || false
    } catch (err) {
      console.error('[dedalus] Connection test failed:', err)
      return false
    }
  }
}

// Singleton instance
let dedalusClientInstance: DedalusClient | null = null

export function getDedalusClient(
  apiKey?: string,
  model?: string
): DedalusClient {
  if (!dedalusClientInstance && apiKey) {
    dedalusClientInstance = new DedalusClient(apiKey, model)
  }

  if (!dedalusClientInstance) {
    throw new Error(
      'Dedalus client not initialized. Please provide API key.'
    )
  }

  return dedalusClientInstance
}

export { DedalusClient }
