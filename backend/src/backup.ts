import { Hono } from 'hono'
import type { Db } from './db.ts'
import { toBook, type BookRow } from './books.ts'
import { ApiError } from './errors.ts'

const FORMAT_VERSION = 1

const STATUSES = ['want', 'reading', 'done'] as const
type Status = (typeof STATUSES)[number]

const PERIOD_TYPES = ['year', 'month'] as const
type PeriodType = (typeof PERIOD_TYPES)[number]

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ApiError(400, 'リクエストボディが正しいJSONではありません')
  }
}

// --- インポートの検証 -------------------------------------------------

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, `${path} は空でない文字列で指定してください`)
  }
  return value
}

function nullableString(value: unknown, path: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new ApiError(400, `${path} は文字列またはnullで指定してください`)
  return value
}

function requireInt(value: unknown, path: string, min: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    const range = max === undefined ? `${min}以上` : `${min}〜${max}`
    throw new ApiError(400, `${path} は${range}の整数で指定してください`)
  }
  return value
}

function nullableInt(value: unknown, path: string, min: number, max?: number): number | null {
  if (value === null) return null
  return requireInt(value, path, min, max)
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(400, `${path} はJSONオブジェクトで指定してください`)
  }
  return value as Record<string, unknown>
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ApiError(400, `${path} は配列で指定してください`)
  return value
}

interface ImportBook {
  id: number
  title: string
  authors: string[]
  isbn: string | null
  pages: number | null
  cover: string | null
  genre: string | null
  status: Status
  current_page: number | null
  rating: number
  review: string | null
  added_at: string
  finished_at: string | null
  favorite: boolean
  tags: string[]
  series: string | null
  volume: number | null
}

function parseImportBook(raw: unknown, index: number): ImportBook {
  const path = `books[${index}]`
  const b = requireObject(raw, path)

  if (!Array.isArray(b.authors) || b.authors.some((a) => typeof a !== 'string')) {
    throw new ApiError(400, `${path}.authors は文字列の配列で指定してください`)
  }
  // favorite・tags・series・volume は後から追加した項目。古いバックアップにはないので、なければ既定値にする
  if (b.tags !== undefined && (!Array.isArray(b.tags) || b.tags.some((t) => typeof t !== 'string'))) {
    throw new ApiError(400, `${path}.tags は文字列の配列で指定してください`)
  }
  if (b.favorite !== undefined && typeof b.favorite !== 'boolean') {
    throw new ApiError(400, `${path}.favorite は true / false で指定してください`)
  }
  if (!STATUSES.includes(b.status as Status)) {
    throw new ApiError(400, `${path}.status は ${STATUSES.join(' / ')} のいずれかで指定してください`)
  }

  return {
    id: requireInt(b.id, `${path}.id`, 1),
    title: requireString(b.title, `${path}.title`),
    authors: b.authors as string[],
    isbn: nullableString(b.isbn, `${path}.isbn`),
    pages: nullableInt(b.pages, `${path}.pages`, 1),
    cover: nullableString(b.cover, `${path}.cover`),
    genre: nullableString(b.genre, `${path}.genre`),
    status: b.status as Status,
    current_page: nullableInt(b.current_page, `${path}.current_page`, 0),
    rating: requireInt(b.rating, `${path}.rating`, 0, 5),
    review: nullableString(b.review, `${path}.review`),
    added_at: requireString(b.added_at, `${path}.added_at`),
    finished_at: nullableString(b.finished_at, `${path}.finished_at`),
    favorite: (b.favorite as boolean | undefined) ?? false,
    tags: (b.tags as string[] | undefined) ?? [],
    series: b.series === undefined ? null : nullableString(b.series, `${path}.series`),
    volume: b.volume === undefined ? null : nullableInt(b.volume, `${path}.volume`, 1),
  }
}

interface ImportLog {
  id: number
  book_id: number
  date: string
  pages: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false
  const [y, m, d] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
}

function parseImportLog(raw: unknown, index: number): ImportLog {
  const path = `reading_logs[${index}]`
  const l = requireObject(raw, path)
  const date = requireString(l.date, `${path}.date`)
  if (!isValidDate(date)) throw new ApiError(400, `${path}.date は YYYY-MM-DD 形式の日付で指定してください`)

  return {
    id: requireInt(l.id, `${path}.id`, 1),
    book_id: requireInt(l.book_id, `${path}.book_id`, 1),
    date,
    pages: requireInt(l.pages, `${path}.pages`, 1),
  }
}

interface ImportQuote {
  id: number
  book_id: number
  text: string
  page: number | null
}

function parseImportQuote(raw: unknown, index: number): ImportQuote {
  const path = `quotes[${index}]`
  const q = requireObject(raw, path)

  return {
    id: requireInt(q.id, `${path}.id`, 1),
    book_id: requireInt(q.book_id, `${path}.book_id`, 1),
    text: requireString(q.text, `${path}.text`),
    page: nullableInt(q.page, `${path}.page`, 1),
  }
}

interface ImportGoal {
  id: number
  period_type: PeriodType
  period: string
  target_books: number | null
  target_daily_pages: number | null
}

function isValidPeriod(type: PeriodType, period: string): boolean {
  if (type === 'year') return /^\d{4}$/.test(period)
  const match = /^\d{4}-(\d{2})$/.exec(period)
  if (!match) return false
  const month = Number(match[1])
  return month >= 1 && month <= 12
}

function parseImportGoal(raw: unknown, index: number): ImportGoal {
  const path = `goals[${index}]`
  const g = requireObject(raw, path)
  if (!PERIOD_TYPES.includes(g.period_type as PeriodType)) {
    throw new ApiError(400, `${path}.period_type は ${PERIOD_TYPES.join(' / ')} のいずれかで指定してください`)
  }
  const periodType = g.period_type as PeriodType
  const period = requireString(g.period, `${path}.period`)
  if (!isValidPeriod(periodType, period)) {
    throw new ApiError(400, `${path}.period の形式が正しくありません`)
  }

  return {
    id: requireInt(g.id, `${path}.id`, 1),
    period_type: periodType,
    period,
    target_books: nullableInt(g.target_books, `${path}.target_books`, 1),
    target_daily_pages: nullableInt(g.target_daily_pages, `${path}.target_daily_pages`, 1),
  }
}

interface ImportPayload {
  books: ImportBook[]
  readingLogs: ImportLog[]
  quotes: ImportQuote[]
  goals: ImportGoal[]
}

/** インポートのJSON全体を検証する。1件でも不正なら、その時点で例外を投げて既存データには触れない。 */
function parseImportPayload(raw: unknown): ImportPayload {
  const body = requireObject(raw, 'リクエストボディ')
  if (body.version !== FORMAT_VERSION) {
    throw new ApiError(400, `version は ${FORMAT_VERSION} のみ対応しています`)
  }

  const books = requireArray(body.books, 'books').map((b, i) => parseImportBook(b, i))
  const bookIds = new Set<number>()
  for (const b of books) {
    if (bookIds.has(b.id)) throw new ApiError(400, `books[].id が重複しています（id=${b.id}）`)
    bookIds.add(b.id)
  }

  const readingLogs = requireArray(body.reading_logs, 'reading_logs').map((l, i) => parseImportLog(l, i))
  const logIds = new Set<number>()
  for (const l of readingLogs) {
    if (logIds.has(l.id)) throw new ApiError(400, `reading_logs[].id が重複しています（id=${l.id}）`)
    logIds.add(l.id)
    if (!bookIds.has(l.book_id)) {
      throw new ApiError(400, `reading_logs[].book_id が books に存在しません（book_id=${l.book_id}）`)
    }
  }

  const quotes = requireArray(body.quotes, 'quotes').map((q, i) => parseImportQuote(q, i))
  const quoteIds = new Set<number>()
  for (const q of quotes) {
    if (quoteIds.has(q.id)) throw new ApiError(400, `quotes[].id が重複しています（id=${q.id}）`)
    quoteIds.add(q.id)
    if (!bookIds.has(q.book_id)) {
      throw new ApiError(400, `quotes[].book_id が books に存在しません（book_id=${q.book_id}）`)
    }
  }

  const goals = requireArray(body.goals, 'goals').map((g, i) => parseImportGoal(g, i))
  const goalIds = new Set<number>()
  const goalKeys = new Set<string>()
  for (const g of goals) {
    if (goalIds.has(g.id)) throw new ApiError(400, `goals[].id が重複しています（id=${g.id}）`)
    goalIds.add(g.id)
    const key = `${g.period_type}:${g.period}`
    if (goalKeys.has(key)) {
      throw new ApiError(400, `goals[] の period_type・period の組み合わせが重複しています（${key}）`)
    }
    goalKeys.add(key)
  }

  return { books, readingLogs, quotes, goals }
}

/** 明示的なIDでINSERTした後、次の自動採番がその値と衝突しないよう sqlite_sequence を合わせる。 */
function resetAutoIncrement(db: Db, table: 'books' | 'reading_logs' | 'quotes' | 'goals') {
  const row = db.prepare(`SELECT COALESCE(MAX(id), 0) AS maxId FROM ${table}`).get() as { maxId: number }
  const result = db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(row.maxId, table)
  if (result.changes === 0) {
    db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(table, row.maxId)
  }
}

export function exportRoutes(db: Db) {
  const routes = new Hono()

  routes.get('/', (c) => {
    const books = (db.prepare('SELECT * FROM books ORDER BY id ASC').all() as BookRow[]).map(toBook)
    const reading_logs = db.prepare('SELECT * FROM reading_logs ORDER BY id ASC').all()
    const quotes = db.prepare('SELECT * FROM quotes ORDER BY id ASC').all()
    const goals = db.prepare('SELECT * FROM goals ORDER BY id ASC').all()

    return c.json({
      version: FORMAT_VERSION,
      exported_at: new Date().toISOString(),
      books,
      reading_logs,
      quotes,
      goals,
    })
  })

  return routes
}

export function importRoutes(db: Db) {
  const routes = new Hono()

  routes.post('/', async (c) => {
    const payload = parseImportPayload(await readJson(c.req.raw))

    const counts = db.transaction(() => {
      db.prepare('DELETE FROM books').run() // reading_logs・quotes は ON DELETE CASCADE で連動削除される
      db.prepare('DELETE FROM goals').run()

      const insertBook = db.prepare(
        `INSERT INTO books
           (id, title, authors, isbn, pages, cover, genre, status, current_page, rating, review, added_at, finished_at,
            favorite, tags, series, volume)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const b of payload.books) {
        insertBook.run(
          b.id,
          b.title,
          JSON.stringify(b.authors),
          b.isbn,
          b.pages,
          b.cover,
          b.genre,
          b.status,
          b.current_page,
          b.rating,
          b.review,
          b.added_at,
          b.finished_at,
          b.favorite ? 1 : 0,
          b.tags.length ? JSON.stringify(b.tags) : null,
          b.series,
          b.volume,
        )
      }

      const insertLog = db.prepare('INSERT INTO reading_logs (id, book_id, date, pages) VALUES (?, ?, ?, ?)')
      for (const l of payload.readingLogs) insertLog.run(l.id, l.book_id, l.date, l.pages)

      const insertQuote = db.prepare('INSERT INTO quotes (id, book_id, text, page) VALUES (?, ?, ?, ?)')
      for (const q of payload.quotes) insertQuote.run(q.id, q.book_id, q.text, q.page)

      const insertGoal = db.prepare(
        'INSERT INTO goals (id, period_type, period, target_books, target_daily_pages) VALUES (?, ?, ?, ?, ?)',
      )
      for (const g of payload.goals) insertGoal.run(g.id, g.period_type, g.period, g.target_books, g.target_daily_pages)

      resetAutoIncrement(db, 'books')
      resetAutoIncrement(db, 'reading_logs')
      resetAutoIncrement(db, 'quotes')
      resetAutoIncrement(db, 'goals')

      return {
        books: payload.books.length,
        reading_logs: payload.readingLogs.length,
        quotes: payload.quotes.length,
        goals: payload.goals.length,
      }
    })()

    return c.json(counts)
  })

  return routes
}
