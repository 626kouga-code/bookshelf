import { Hono } from 'hono'
import type { Db } from './db.ts'
import { ApiError } from './errors.ts'

interface QuoteRow {
  id: number
  book_id: number
  text: string
  page: number | null
}

interface QuoteInput {
  text: string
  page: number | null
}

function parseQuoteInput(raw: unknown): QuoteInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, 'リクエストボディはJSONオブジェクトで指定してください')
  }
  const body = raw as Record<string, unknown>

  if (typeof body.text !== 'string' || body.text.trim() === '') {
    throw new ApiError(400, 'text は空でない文字列で指定してください')
  }

  let page: number | null = null
  if (body.page !== undefined && body.page !== null) {
    if (typeof body.page !== 'number' || !Number.isInteger(body.page) || body.page < 1) {
      throw new ApiError(400, 'page は1以上の整数で指定してください')
    }
    page = body.page
  }

  return { text: body.text.trim(), page }
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

export function quotesRoutes(db: Db) {
  const routes = new Hono()

  const requireBook = (id: number) => {
    const row = db.prepare('SELECT id FROM books WHERE id = ?').get(id) as { id: number } | undefined
    if (!row) throw new ApiError(404, '本が見つかりません')
  }

  routes.get('/', (c) => {
    const bookId = parseId(c.req.param('id'))
    requireBook(bookId)
    const rows = db
      .prepare('SELECT * FROM quotes WHERE book_id = ? ORDER BY id DESC')
      .all(bookId) as QuoteRow[]
    return c.json(rows)
  })

  routes.post('/', async (c) => {
    const bookId = parseId(c.req.param('id'))
    requireBook(bookId)
    const input = parseQuoteInput(await readJson(c.req.raw))

    const result = db
      .prepare('INSERT INTO quotes (book_id, text, page) VALUES (?, ?, ?)')
      .run(bookId, input.text, input.page)

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(result.lastInsertRowid)
    return c.json(quote, 201)
  })

  routes.delete('/:quoteId', (c) => {
    const bookId = parseId(c.req.param('id'))
    requireBook(bookId)
    const quoteId = parseId(c.req.param('quoteId'))
    const row = db
      .prepare('SELECT id FROM quotes WHERE id = ? AND book_id = ?')
      .get(quoteId, bookId) as { id: number } | undefined
    if (!row) throw new ApiError(404, '引用が見つかりません')

    db.prepare('DELETE FROM quotes WHERE id = ?').run(quoteId)
    return c.body(null, 204)
  })

  return routes
}

/** `GET /api/quotes?q=` 全本の引用をキーワードで横断検索する。 */
export function quoteSearchRoutes(db: Db) {
  const routes = new Hono()

  routes.get('/', (c) => {
    const q = c.req.query('q')
    const where = q ? "WHERE quotes.text LIKE ? ESCAPE '\\'" : ''
    const params: string[] = []
    if (q) params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`)

    const rows = db
      .prepare(
        `SELECT quotes.id, quotes.book_id, quotes.text, quotes.page, books.title AS book_title
           FROM quotes JOIN books ON books.id = quotes.book_id
           ${where}
           ORDER BY quotes.id DESC`,
      )
      .all(...params)
    return c.json(rows)
  })

  return routes
}
