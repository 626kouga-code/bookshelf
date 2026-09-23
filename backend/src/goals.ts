import { Hono } from 'hono'
import type { Db } from './db.ts'
import { ApiError } from './errors.ts'

type PeriodType = 'year' | 'month'

interface GoalRow {
  id: number
  period_type: PeriodType
  period: string
  target_books: number | null
  target_daily_pages: number | null
}

/** 指定なしのときに使う「現在の」期間（`YYYY` または `YYYY-MM`）。 */
function currentPeriod(type: PeriodType): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return type === 'year' ? String(y) : `${y}-${m}`
}

function isValidPeriod(type: PeriodType, period: string): boolean {
  if (type === 'year') return /^\d{4}$/.test(period)
  const match = /^\d{4}-(\d{2})$/.exec(period)
  if (!match) return false
  const month = Number(match[1])
  return month >= 1 && month <= 12
}

interface Query {
  type: PeriodType
  period: string
}

function parseQuery(query: Record<string, string>): Query {
  const type = query.period_type
  if (type !== 'year' && type !== 'month') {
    throw new ApiError(400, 'period_type は year / month のいずれかで指定してください')
  }
  const period = query.period && query.period !== '' ? query.period : currentPeriod(type)
  if (!isValidPeriod(type, period)) {
    throw new ApiError(400, `period は ${type === 'year' ? 'YYYY' : 'YYYY-MM'} の形式で指定してください`)
  }
  return { type, period }
}

interface GoalInput {
  target_books?: number | null
  target_daily_pages?: number | null
}

function optionalPositiveInt(body: Record<string, unknown>, key: string): number | null | undefined {
  const v = body[key]
  if (v === undefined || v === null) return v
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new ApiError(400, `${key} は1以上の整数で指定してください`)
  }
  return v
}

function parseGoalInput(raw: unknown): GoalInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, 'リクエストボディはJSONオブジェクトで指定してください')
  }
  const body = raw as Record<string, unknown>
  return {
    target_books: optionalPositiveInt(body, 'target_books'),
    target_daily_pages: optionalPositiveInt(body, 'target_daily_pages'),
  }
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ApiError(400, 'リクエストボディが正しいJSONではありません')
  }
}

export function goalsRoutes(db: Db) {
  const routes = new Hono()

  const find = (type: PeriodType, period: string) =>
    db.prepare('SELECT * FROM goals WHERE period_type = ? AND period = ?').get(type, period) as
      | GoalRow
      | undefined

  routes.get('/', (c) => {
    const { type, period } = parseQuery(c.req.query())
    const row = find(type, period)
    return c.json(row ?? { period_type: type, period, target_books: null, target_daily_pages: null })
  })

  routes.put('/', async (c) => {
    const { type, period } = parseQuery(c.req.query())
    const input = parseGoalInput(await readJson(c.req.raw))
    const existing = find(type, period)

    const targetBooks = input.target_books === undefined ? (existing?.target_books ?? null) : input.target_books
    const targetDailyPages =
      input.target_daily_pages === undefined ? (existing?.target_daily_pages ?? null) : input.target_daily_pages

    if (existing) {
      db.prepare('UPDATE goals SET target_books = ?, target_daily_pages = ? WHERE id = ?').run(
        targetBooks,
        targetDailyPages,
        existing.id,
      )
    } else {
      db.prepare(
        'INSERT INTO goals (period_type, period, target_books, target_daily_pages) VALUES (?, ?, ?, ?)',
      ).run(type, period, targetBooks, targetDailyPages)
    }

    return c.json(find(type, period))
  })

  return routes
}
