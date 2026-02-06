/**
 * Data Aggregator
 * Creates privacy-safe summaries of financial data
 * Only aggregates (totals, averages, counts) are sent to AI - no raw transactions
 */

import type { Transaction } from './financialParser'
import * as crypto from 'crypto'

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
  monthlyTrends: Record<string, number> // "2024-01" -> total
  dateRange: {
    start: Date
    end: Date
  }
  averageTransactionAmount: number
  categoriesCount: number
}

export interface MonthlySpending {
  month: string // "2024-01"
  totalSpending: number
  categoryBreakdown: Record<string, number>
  transactionCount: number
}

export interface CategoryTrend {
  category: string
  trend: 'up' | 'down' | 'stable'
  change: number // percentage
  currentTotal: number
  previousTotal: number
}

export interface TrendData {
  monthlyData: MonthlySpending[]
  categoryTrends: Record<string, CategoryTrend>
  overallTrend: {
    direction: 'up' | 'down' | 'stable'
    percentChange: number
  }
}

/**
 * Format date as YYYY-MM for monthly grouping
 */
function formatMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Aggregate transactions into privacy-safe summary
 * No individual transaction details are exposed
 */
export function aggregateTransactions(
  transactions: Transaction[]
): SpendingSummary {
  if (transactions.length === 0) {
    return {
      totalSpending: 0,
      transactionCount: 0,
      categoryBreakdown: {},
      monthlyTrends: {},
      dateRange: {
        start: new Date(),
        end: new Date(),
      },
      averageTransactionAmount: 0,
      categoriesCount: 0,
    }
  }

  // Calculate totals
  const totalSpending = transactions.reduce(
    (sum, t) => sum + t.amount,
    0
  )

  // Group by category
  const categoryBreakdown: Record<string, CategoryStats> = {}
  for (const transaction of transactions) {
    const cat = transaction.category
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = {
        total: 0,
        count: 0,
        avg: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
      }
    }

    categoryBreakdown[cat].total += transaction.amount
    categoryBreakdown[cat].count += 1
    categoryBreakdown[cat].min = Math.min(
      categoryBreakdown[cat].min,
      transaction.amount
    )
    categoryBreakdown[cat].max = Math.max(
      categoryBreakdown[cat].max,
      transaction.amount
    )
  }

  // Calculate averages for each category
  for (const cat in categoryBreakdown) {
    categoryBreakdown[cat].avg =
      categoryBreakdown[cat].total /
      categoryBreakdown[cat].count
  }

  // Group by month
  const monthlyTrends: Record<string, number> = {}
  for (const transaction of transactions) {
    const month = formatMonth(transaction.date)
    if (!monthlyTrends[month]) {
      monthlyTrends[month] = 0
    }
    monthlyTrends[month] += transaction.amount
  }

  // Find date range
  const dates = transactions.map((t) => t.date.getTime())
  const dateRange = {
    start: new Date(Math.min(...dates)),
    end: new Date(Math.max(...dates)),
  }

  return {
    totalSpending,
    transactionCount: transactions.length,
    categoryBreakdown,
    monthlyTrends,
    dateRange,
    averageTransactionAmount: totalSpending / transactions.length,
    categoriesCount: Object.keys(categoryBreakdown).length,
  }
}

/**
 * Aggregate transactions by month for trend visualization
 */
export function aggregateByMonth(
  transactions: Transaction[]
): MonthlySpending[] {
  if (transactions.length === 0) return []

  const monthlyData: Record<
    string,
    {
      total: number
      categories: Record<string, number>
      count: number
    }
  > = {}

  for (const transaction of transactions) {
    const month = formatMonth(transaction.date)

    if (!monthlyData[month]) {
      monthlyData[month] = {
        total: 0,
        categories: {},
        count: 0,
      }
    }

    monthlyData[month].total += transaction.amount
    monthlyData[month].count += 1

    const cat = transaction.category
    if (!monthlyData[month].categories[cat]) {
      monthlyData[month].categories[cat] = 0
    }
    monthlyData[month].categories[cat] += transaction.amount
  }

  // Convert to array and sort by month
  return Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      totalSpending: data.total,
      categoryBreakdown: data.categories,
      transactionCount: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * Calculate spending trends over time
 */
export function calculateTrends(
  transactions: Transaction[]
): TrendData {
  const monthlyData = aggregateByMonth(transactions)

  if (monthlyData.length < 2) {
    // Not enough data for trends
    return {
      monthlyData,
      categoryTrends: {},
      overallTrend: {
        direction: 'stable',
        percentChange: 0,
      },
    }
  }

  // Calculate overall trend (comparing first half vs second half)
  const midpoint = Math.floor(monthlyData.length / 2)
  const firstHalf = monthlyData.slice(0, midpoint)
  const secondHalf = monthlyData.slice(midpoint)

  const firstHalfAvg =
    firstHalf.reduce((sum, m) => sum + m.totalSpending, 0) /
    firstHalf.length
  const secondHalfAvg =
    secondHalf.reduce((sum, m) => sum + m.totalSpending, 0) /
    secondHalf.length

  const percentChange =
    ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100

  let direction: 'up' | 'down' | 'stable' = 'stable'
  if (percentChange > 5) direction = 'up'
  else if (percentChange < -5) direction = 'down'

  // Calculate category-level trends
  const categoryTrends: Record<string, CategoryTrend> = {}

  // Get all categories
  const allCategories = new Set<string>()
  transactions.forEach((t) => allCategories.add(t.category))

  for (const category of allCategories) {
    // Get transactions for this category
    const catTransactions = transactions.filter(
      (t) => t.category === category
    )

    if (catTransactions.length < 2) continue

    // Split into two halves
    const catMidpoint = Math.floor(catTransactions.length / 2)
    const catFirstHalf = catTransactions.slice(0, catMidpoint)
    const catSecondHalf = catTransactions.slice(catMidpoint)

    const catFirstTotal = catFirstHalf.reduce(
      (sum, t) => sum + t.amount,
      0
    )
    const catSecondTotal = catSecondHalf.reduce(
      (sum, t) => sum + t.amount,
      0
    )

    const catChange =
      ((catSecondTotal - catFirstTotal) / catFirstTotal) * 100

    let catDirection: 'up' | 'down' | 'stable' = 'stable'
    if (catChange > 5) catDirection = 'up'
    else if (catChange < -5) catDirection = 'down'

    categoryTrends[category] = {
      category,
      trend: catDirection,
      change: catChange,
      currentTotal: catSecondTotal,
      previousTotal: catFirstTotal,
    }
  }

  return {
    monthlyData,
    categoryTrends,
    overallTrend: {
      direction,
      percentChange,
    },
  }
}

/**
 * Generate a hash of transaction data for cache invalidation
 * This allows us to detect when underlying data has changed
 */
export function generateDataHash(
  transactions: Transaction[]
): string {
  // Create a stable string representation of the data
  const dataString = transactions
    .map(
      (t) =>
        `${t.date.toISOString()}|${t.amount}|${t.category}|${t.description}`
    )
    .join('\n')

  return crypto
    .createHash('sha256')
    .update(dataString)
    .digest('hex')
}
