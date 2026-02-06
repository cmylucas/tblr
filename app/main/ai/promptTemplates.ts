/**
 * Prompt Templates
 * Centralized prompt engineering for AI analysis
 */

import type { SpendingSummary, TrendData } from './dataAggregator'

export interface UserGoals {
  monthlySavingsTarget?: number
  categoryLimits?: Record<string, number>
  priorities?: string[]
}

export const PROMPTS = {
  /**
   * Analyze spending summary and provide insights
   */
  ANALYZE_SPENDING: (summary: SpendingSummary, context?: string) => `
You are a financial analyst helping users understand their spending patterns.

Analyze the following spending data and provide actionable insights:

**Total Spending:** $${summary.totalSpending.toFixed(2)}
**Transaction Count:** ${summary.transactionCount}
**Average Transaction:** $${summary.averageTransactionAmount.toFixed(2)}
**Categories:** ${summary.categoriesCount}
**Date Range:** ${summary.dateRange.start.toLocaleDateString()} to ${summary.dateRange.end.toLocaleDateString()}

**Category Breakdown:**
${Object.entries(summary.categoryBreakdown)
  .map(
    ([cat, stats]) =>
      `- ${cat}: $${stats.total.toFixed(2)} (${stats.count} transactions, avg $${stats.avg.toFixed(2)})`
  )
  .join('\n')}

**Monthly Trends:**
${Object.entries(summary.monthlyTrends)
  .map(([month, total]) => `- ${month}: $${total.toFixed(2)}`)
  .join('\n')}

${context ? `\n**User Context:** ${context}\n` : ''}

Provide your analysis in the following JSON format:
{
  "insights": [
    {
      "category": "Groceries",
      "currentSpending": 450,
      "recommendedBudget": 400,
      "reasoning": "Based on your spending pattern, you could reduce groceries by meal planning",
      "priority": "medium"
    }
  ],
  "anomalies": [
    {
      "category": "Dining",
      "amount": 500,
      "date": "2024-01-15",
      "reason": "Unusually high spending compared to your average of $150"
    }
  ],
  "summary": {
    "totalSpending": ${summary.totalSpending},
    "trend": "up|down|stable",
    "trendPercent": 5.2
  },
  "recommendations": [
    {
      "category": "Dining",
      "action": "Reduce dining out by $150/month",
      "expectedSavings": 150,
      "priority": "high"
    }
  ]
}

Focus on:
1. Identifying overspending categories
2. Detecting anomalies (unusual transactions)
3. Providing specific, actionable recommendations
4. Being realistic and considerate of lifestyle needs
`,

  /**
   * Predict future spending based on historical data
   */
  PREDICT_FUTURE: (params: {
    summary: SpendingSummary
    trends: TrendData
    months: number
  }) => `
You are a financial forecasting expert. Predict future spending for the next ${params.months} months.

**Historical Data:**
Total Spending: $${params.summary.totalSpending.toFixed(2)}
Monthly Average: $${(params.summary.totalSpending / Object.keys(params.summary.monthlyTrends).length).toFixed(2)}

**Category Breakdown:**
${Object.entries(params.summary.categoryBreakdown)
  .map(
    ([cat, stats]) =>
      `- ${cat}: $${stats.total.toFixed(2)} (avg $${stats.avg.toFixed(2)}/transaction)`
  )
  .join('\n')}

**Detected Trends:**
Overall Trend: ${params.trends.overallTrend.direction} (${params.trends.overallTrend.percentChange.toFixed(1)}%)

Category Trends:
${Object.entries(params.trends.categoryTrends)
  .map(
    ([cat, trend]) =>
      `- ${cat}: ${trend.trend} (${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%)`
  )
  .join('\n')}

**Monthly History:**
${params.trends.monthlyData.map((m) => `${m.month}: $${m.totalSpending.toFixed(2)}`).join(', ')}

Provide predictions in this JSON format:
{
  "predictions": [
    {
      "month": "2025-03",
      "categoryPredictions": {
        "Groceries": {
          "predictedAmount": 450,
          "confidence": "high",
          "reasoning": "Consistent spending pattern over past 6 months",
          "factors": ["Historical average", "No seasonal variation detected"]
        }
      },
      "totalPredicted": 2100,
      "confidenceScore": 0.85
    }
  ]
}

Consider:
- Historical patterns and trends
- Seasonal variations
- Category-specific growth rates
- Economic conditions (assume moderate 3% inflation)
- Typical spending fluctuations
`,

  /**
   * Generate personalized budget plan
   */
  BUDGET_PLAN: (params: {
    current: SpendingSummary
    goals: UserGoals
  }) => `
You are a financial advisor creating a personalized monthly budget plan.

**Current Spending:**
Total: $${params.current.totalSpending.toFixed(2)}
Categories:
${Object.entries(params.current.categoryBreakdown)
  .map(
    ([cat, stats]) =>
      `- ${cat}: $${stats.total.toFixed(2)}`
  )
  .join('\n')}

**User Goals:**
${params.goals.monthlySavingsTarget ? `Savings Target: $${params.goals.monthlySavingsTarget}/month` : 'No specific savings target'}
${params.goals.priorities ? `Priorities: ${params.goals.priorities.join(', ')}` : ''}

Create a realistic budget that:
1. Helps achieve the savings goal
2. Identifies where spending can be reduced
3. Maintains essential spending (groceries, utilities, etc.)
4. Provides specific actions

Return in this JSON format:
{
  "budgetPlan": {
    "month": "2025-03",
    "categoryBudgets": {
      "Groceries": {
        "budgetAmount": 400,
        "basedOn": "ai-recommendation",
        "expectedSavings": 50
      }
    },
    "totalBudget": 1950,
    "savingsGoal": ${params.goals.monthlySavingsTarget || 0},
    "notes": "Focus on reducing dining out to meet savings goal"
  }
}

Be realistic - don't suggest cuts that would be difficult to maintain.
`,
}
