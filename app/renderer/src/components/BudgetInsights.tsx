import { sectionStyle, labelStyle, btnStyle } from './styles'

interface BudgetInsight {
  category: string
  currentSpending: number
  recommendedBudget: number
  reasoning: string
  priority: 'high' | 'medium' | 'low'
}

interface Anomaly {
  category: string
  amount: number
  date: string
  reason: string
}

interface Recommendation {
  category: string
  action: string
  expectedSavings: number
  priority: 'high' | 'medium' | 'low'
}

interface AnalysisResult {
  insights: BudgetInsight[]
  anomalies: Anomaly[]
  summary: {
    totalSpending: number
    trend: 'up' | 'down' | 'stable'
    trendPercent: number
  }
  recommendations: Recommendation[]
  transactionCount: number
  dateRange: {
    start: Date
    end: Date
  }
}

interface Props {
  analysis: AnalysisResult | null
  loading: boolean
  onRefresh?: () => void
}

// Category icon mapping
const getCategoryIcon = (category: string): string => {
  const cat = category.toLowerCase()
  if (cat.includes('food') || cat.includes('groceries') || cat.includes('grocery')) return '🛒'
  if (cat.includes('dining') || cat.includes('restaurant')) return '🍔'
  if (cat.includes('transport') || cat.includes('gas') || cat.includes('car')) return '🚗'
  if (cat.includes('entertainment') || cat.includes('movie')) return '🎬'
  if (cat.includes('utilities') || cat.includes('electric') || cat.includes('water')) return '💡'
  if (cat.includes('housing') || cat.includes('rent') || cat.includes('mortgage')) return '🏠'
  if (cat.includes('health') || cat.includes('medical')) return '🏥'
  if (cat.includes('shopping') || cat.includes('clothing')) return '👕'
  return '💰'
}

// Priority color
const getPriorityColor = (priority: string): string => {
  if (priority === 'high') return '#ff4444'
  if (priority === 'medium') return '#ffb700'
  return '#2ecc40'
}

// Budget status color
const getBudgetStatusColor = (current: number, recommended: number): string => {
  const ratio = current / recommended
  if (ratio > 1.1) return '#ff4444' // Over budget
  if (ratio > 0.95) return '#ffb700' // Approaching limit
  return '#2ecc40' // Under budget
}

export default function BudgetInsights({ analysis, loading, onRefresh }: Props) {
  if (loading) {
    return (
      <div style={sectionStyle}>
        <div style={labelStyle}>BUDGET INSIGHTS</div>
        <div style={{ textAlign: 'center', padding: 20, opacity: 0.7 }}>
          <div style={{ marginBottom: 8 }}>🤖 Analyzing your spending...</div>
          <div style={{ fontSize: 11 }}>This may take a few seconds</div>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return null
  }

  const { insights, anomalies, summary, recommendations, transactionCount, dateRange } = analysis

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={labelStyle}>BUDGET INSIGHTS</div>
        {onRefresh && (
          <button onClick={onRefresh} style={{ ...btnStyle, fontSize: 10, padding: '3px 8px' }}>
            Refresh
          </button>
        )}
      </div>

      {/* Summary card */}
      <div
        style={{
          background: 'rgba(10,132,255,0.1)',
          borderRadius: 6,
          padding: 10,
          marginBottom: 12,
          border: '1px solid rgba(10,132,255,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>Total Spending</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>${summary.totalSpending.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, opacity: 0.7 }}>Trend</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {summary.trend === 'up' ? '↑' : summary.trend === 'down' ? '↓' : '→'}{' '}
              {Math.abs(summary.trendPercent).toFixed(1)}%
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, opacity: 0.6 }}>
          {transactionCount} transactions • {new Date(dateRange.start).toLocaleDateString()} to{' '}
          {new Date(dateRange.end).toLocaleDateString()}
        </div>
      </div>

      {/* Category insights */}
      {insights.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, opacity: 0.7 }}>
            CATEGORY BREAKDOWN
          </div>
          {insights.map((insight) => {
            const statusColor = getBudgetStatusColor(insight.currentSpending, insight.recommendedBudget)
            return (
              <div
                key={insight.category}
                style={{
                  marginBottom: 8,
                  padding: 8,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                  borderLeft: `3px solid ${statusColor}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>
                    {getCategoryIcon(insight.category)} {insight.category}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>
                    ${insight.currentSpending.toFixed(2)} / ${insight.recommendedBudget.toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.4 }}>{insight.reasoning}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              background: 'rgba(255,68,68,0.1)',
              borderRadius: 6,
              padding: 8,
              border: '1px solid rgba(255,68,68,0.3)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#ff4444' }}>
              ⚠️ {anomalies.length} ANOMAL{anomalies.length === 1 ? 'Y' : 'IES'} DETECTED
            </div>
            {anomalies.map((anomaly, i) => (
              <div key={i} style={{ marginBottom: i < anomalies.length - 1 ? 6 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>
                  {getCategoryIcon(anomaly.category)} {anomaly.category} - ${anomaly.amount.toFixed(2)}
                </div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{anomaly.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, opacity: 0.7 }}>
            RECOMMENDATIONS
          </div>
          {recommendations.map((rec, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'start',
                marginBottom: 6,
                padding: 6,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  marginRight: 8,
                  fontSize: 16,
                  color: getPriorityColor(rec.priority),
                }}
              >
                {rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{rec.action}</div>
                {rec.expectedSavings > 0 && (
                  <div style={{ fontSize: 10, opacity: 0.7, color: '#2ecc40' }}>
                    Save ${rec.expectedSavings.toFixed(2)}/month
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {insights.length === 0 && anomalies.length === 0 && recommendations.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>
          <div>No insights available</div>
          <div style={{ fontSize: 10, marginTop: 4 }}>Try analyzing more transactions</div>
        </div>
      )}
    </div>
  )
}
