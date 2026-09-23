import { Hono } from 'hono'
import type { Db } from './db.ts'
import { ApiError } from './errors.ts'

interface BookRow {
  id: number
  pages: number | null
  status: 'want' | 'reading' | 'done'
  current_page: number | null
}

interface LogRow {
  id: number
  book_id: number
  date: string
  pages: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` 形式かつ実在の日付かを確認する。 */
function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false
  const [y, m, d] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
}

interface LogInput {
  date: string
  pages: number
}

function parseLogInput(raw: unknown): LogInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, 'リクエストボディはJSONオブジェクトで指定してください')
  }
  const body = raw as Record<string, unknown>

  if (typeof body.date !== 'string' || !isValidDate(body.date)) {
    throw new ApiError(400, 'date は YYYY-MM-DD 形式の日付で指定してください')
  }
  if (typeof body.pages !== 'number' || !Number.isInteger(body.pages) || body.pages < 1) {
    throw new ApiError(400, 'pages は1以上の整数で指定してください')
  }

  return { date: body.date, pages: body.pages }
}

function parseId(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) throw new ApiError(400, 'id は正の整数で指定してください')
  return Number(value)
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ApiError(400, 'リクエストボディが正しいJSONではありません')
  }
}

/** 直近14日間のログから1日あたりの平均ページ数を求める。ログがなければ null。 */
function recentPace(logs: LogRow[]): number | null {
  const WINDOW_DAYS = 14
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const windowStart = new Date(today)
  windowStart.setUTCDate(windowStart.getUTCDate() - (WINDOW_DAYS - 1))

  const total = logs
    .filter((log) => {
      const d = new Date(`${log.date}T00:00:00Z`)
      return d >= windowStart && d <= today
    })
    .reduce((sum, log) => sum + log.pages, 0)

  return total > 0 ? total / WINDOW_DAYS : null
}

export function logsRoutes(db: Db) {
  const routes = new Hono()

  const requireBook = (id: number) => {
    const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as BookRow | undefined
    if (!row) throw new ApiError(404, '本が見つかりません')
    return row
  }

  const requireLog = (bookId: number, logId: number) => {
    const row = db
      .prepare('SELECT * FROM reading_logs WHERE id = ? AND book_id = ?')
      .get(logId, bookId) as LogRow | undefined
    if (!row) throw new ApiError(404, '読書ログが見つかりません')
    return row
  }

  routes.get('/', (c) => {
    const bookId = parseId(c.req.param('id'))
    requireBook(bookId)
    const rows = db
      .prepare('SELECT * FROM reading_logs WHERE book_id = ? ORDER BY date DESC, id DESC')
      .all(bookId) as LogRow[]
    return c.json(rows)
  })

  routes.post('/', async (c) => {
    const bookId = parseId(c.req.param('id'))
    const book = requireBook(bookId)
    const input = parseLogInput(await readJson(c.req.raw))

    const result = db
      .prepare('INSERT INTO reading_logs (book_id, date, pages) VALUES (?, ?, ?)')
      .run(bookId, input.date, input.pages)

    let currentPage = (book.current_page ?? 0) + input.pages
    if (book.pages !== null) currentPage = Math.min(currentPage, book.pages)
    const status = book.status === 'want' ? 'reading' : book.status

    db.prepare('UPDATE books SET current_page = ?, status = ? WHERE id = ?').run(
      currentPage,
      status,
      bookId,
    )

    const log = db.prepare('SELECT * FROM reading_logs WHERE id = ?').get(result.lastInsertRowid)
    return c.json(log, 201)
  })

  routes.delete('/:logId', (c) => {
    const bookId = parseId(c.req.param('id'))
    const book = requireBook(bookId)
    const logId = parseId(c.req.param('logId'))
    const log = requireLog(bookId, logId)

    db.prepare('DELETE FROM reading_logs WHERE id = ?').run(logId)
    const currentPage = Math.max((book.current_page ?? 0) - log.pages, 0)
    db.prepare('UPDATE books SET current_page = ? WHERE id = ?').run(currentPage, bookId)

    return c.body(null, 204)
  })

  return routes
}

export function predictionRoutes(db: Db) {
  const routes = new Hono()

  routes.get('/', (c) => {
    const bookId = parseId(c.req.param('id'))
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as BookRow | undefined
    if (!book) throw new ApiError(404, '本が見つかりません')

    if (book.pages === null || book.current_page === null) {
      return c.json({ available: false, reason: '総ページ数または現在のページが未設定です' })
    }

    const remaining = book.pages - book.current_page
    if (remaining <= 0) {
      return c.json({ available: false, reason: '既に最後まで読んでいます' })
    }

    const logs = db.prepare('SELECT * FROM reading_logs WHERE book_id = ?').all(bookId) as LogRow[]
    const pace = recentPace(logs)
    if (pace === null) {
      return c.json({ available: false, reason: '直近の読書ログがありません' })
    }

    const estimatedDays = Math.ceil(remaining / pace)
    return c.json({ available: true, remainingPages: remaining, pagesPerDay: pace, estimatedDays })
  })

  return routes
}
