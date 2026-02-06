// ── Domain types ──

export interface AuditEntry {
  id: string
  timestamp: string
  operation:
    | 'attach'
    | 'read'
    | 'write'
    | 'signIn'
    | 'signOut'
    | 'ai:analyze'
    | 'ai:predict'
    | 'ai:budget'
  spreadsheetId?: string
  range?: string
  rowCount?: number
  colCount?: number
  success: boolean
  message?: string
}

export interface AppStatus {
  signedIn: boolean
  email?: string
  attached: boolean
  spreadsheetId?: string
  sheetNames?: string[]
}

// ── IPC channel names ──

export const IPC = {
  ATTACH_SHEET: 'sheets:attach',
  SIGN_IN: 'auth:signIn',
  SIGN_OUT: 'auth:signOut',
  READ_RANGE: 'sheets:readRange',
  WRITE_RANGE: 'sheets:writeRange',
  GET_STATUS: 'app:getStatus',
  GET_AUDIT_LOG: 'app:getAuditLog',
  // AI operations
  AI_ANALYZE_FINANCIAL_DATA: 'ai:analyzeFinancialData',
  AI_GET_INSIGHTS: 'ai:getInsights',
} as const

// ── IPC response wrapper ──

export interface IpcResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// ── AI/Financial types ──

export interface ColumnMapping {
  dateColumn: number
  amountColumn: number
  categoryColumn?: number
  descriptionColumn?: number
}

export interface Transaction {
  date: Date
  amount: number
  category: string
  description: string
  rawRow: string[]
}

export interface CategoryStats {
  total: number
  count: number
  avg: number
  min: number
  max: number
}

export interface SpendingSummary {
  totalSpending: number
  transactionCount: number
  categoryBreakdown: Record<string, CategoryStats>
  monthlyTrends: Record<string, number>
  dateRange: {
    start: Date
    end: Date
  }
  averageTransactionAmount: number
  categoriesCount: number
}

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

export interface AnalysisResult {
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
