/**
 * SQLite client wrapper using better-sqlite3
 * Provides simple, synchronous API for dataset queries
 */

import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

export interface QueryResult {
  rows: any[]
  rowCount: number
}

export class SqliteClient {
  private db: Database.Database

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL') // Better concurrent access
    this.db.pragma('foreign_keys = ON')
  }

  /**
   * Execute a SELECT query with automatic LIMIT enforcement
   */
  query(sql: string, params: any[] = [], maxRows: number = 5000): QueryResult {
    // Enforce SELECT only
    const trimmedSql = sql.trim().toUpperCase()
    if (!trimmedSql.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed')
    }

    // Enforce LIMIT if not present
    let finalSql = sql
    if (!sql.toUpperCase().includes('LIMIT')) {
      finalSql = `${sql} LIMIT ${maxRows}`
    }

    const stmt = this.db.prepare(finalSql)
    const rows = stmt.all(...params)

    return {
      rows,
      rowCount: rows.length,
    }
  }

  /**
   * Execute a non-SELECT statement (INSERT, CREATE, etc.)
   */
  exec(sql: string): void {
    this.db.exec(sql)
  }

  /**
   * Execute a prepared statement (for bulk inserts)
   */
  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql)
  }

  /**
   * Begin a transaction
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close()
  }

  /**
   * Get database stats
   */
  getStats(): { pageCount: number; pageSize: number; sizeBytes: number } {
    const pageCountResult = this.db.pragma('page_count', { simple: true }) as number
    const pageSizeResult = this.db.pragma('page_size', { simple: true }) as number

    return {
      pageCount: pageCountResult,
      pageSize: pageSizeResult,
      sizeBytes: pageCountResult * pageSizeResult,
    }
  }
}
