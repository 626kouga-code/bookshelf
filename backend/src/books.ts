import { Hono } from 'hono'
import type { Db } from './db.ts'
import { ApiError } from './errors.ts'
import { normalizeIsbn } from './isbn.ts'

const STATUSES = ['want', 'reading', 'done'] as const
type Status = (typeof STATUSES)[number]

interface BookRow {
  id: number
  title: string
  authors: string | null
  isbn: string | null
  pages: number | null
  cover: string | null
  genre: string | null
  status: Status
  current_page: number | null
  rating: number | null
  review: string | null
  added_at: string | null
  finished_at: string | null
}

/** 書き込み可能な項目。undefined は「指定なし」、null は「値を消す」。 */
interface BookInput {
  title?: string
  authors?: string[] | null
  isbn?: string | null
  pages?: number | null
  cover?: string | null
  genre?: string | null
  status?: Status
  current_page?: number | null
  rating?: number | null
  review?: string | null
}

function toBook(row: BookRow) {
  return { ...row, authors: row.authors ? (JSON.parse(row.authors) as string[]) : [] }
}

function optionalString(body: Record<string, unknown>, key: string): string | null | undefined {
  const v = body[key]
  if (v === undefined || v === null) return v
  if (typeof v !== 'string') throw new ApiError(400, `${key} は文字列で指定してください`)
  return v.trim() === '' ? null : v
}

function optionalInt(
  body: Record<string, unknown>,
  key: string,
  min: number,
  max?: number,
): number | null | undefined {
  const v = body[key]
  if (v === undefined || v === null) return v
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || (max !== undefined && v > max)) {
    const range = max === undefined ? `${min}以上` : `${min}〜${max}`
    throw new ApiError(400, `${key} は ${range} の整数で指定してください`)
  }
  return v
}

/** リクエストボディを検証して BookInput にする。 */
function parseBookInput(raw: unknown): BookInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiError(400, 'リクエストボディはJSONオブジェクトで指定してください')
  }
  const body = raw as Record<string, unknown>
  const input: BookInput = {}

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      throw new ApiError(400, 'title は空でない文字列で指定してください')
    }
    input.title = body.title.trim()
  }

  if (body.authors === null) {
    input.authors = null
  } else if (body.authors !== undefined) {
    if (!Array.isArray(body.authors) || body.authors.some((a) => typeof a !== 'string')) {
      throw new ApiError(400, 'authors は文字列の配列で指定してください')
    }
    input.authors = (body.authors as string[]).map((a) => a.trim()).filter((a) => a !== '')
  }

  const isbn = optionalString(body, 'isbn')
  if (isbn === null) {
    input.isbn = null
  } else if (isbn !== undefined) {
    const normalized = normalizeIsbn(isbn)
    if (normalized === null) throw new ApiError(400, 'isbn の形式が正しくありません')
    input.isbn = normalized
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as Status)) {
      throw new ApiError(400, `status は ${STATUSES.join(' / ')} のいずれかで指定してください`)
    }
    input.status = body.status as Status
  }

  const optionals = {
    pages: optionalInt(body, 'pages', 1),
    current_page: optionalInt(body, 'current_page', 0),
    rating: optionalInt(body, 'rating', 0, 5),
    cover: optionalString(body, 'cover'),
    genre: optionalString(body, 'genre'),
    review: optionalString(body, 'review'),
  }
  for (const [key, value] of Object.entries(optionals)) {
    if (value !== undefined) Object.assign(input, { [key]: value })
  }

  return input
}

function parseId(value: string): number {
  if (!/^\d+$/.test(value)) throw new ApiError(400, 'id は正の整数で指定してください')
  return Number(value)
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ApiError(400, 'リクエストボディが正しいJSONではありません')
  }
}

export function booksRoutes(db: Db) {
  const routes = new Hono()

  const requireBook = (id: number) => {
    const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as BookRow | undefined
    if (!row) throw new ApiError(404, '本が見つかりません')
    return row
  }

  const ensureIsbnFree = (isbn: string | null | undefined, selfId?: number) => {
    if (!isbn) return
    const dup = db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn) as
      | { id: number }
      | undefined
    if (dup && dup.id !== selfId) throw new ApiError(409, '同じISBNの本が既に登録されています')
  }

  routes.post('/', async (c) => {
    const input = parseBookInput(await readJson(c.req.raw))
    if (input.title === undefined) throw new ApiError(400, 'title は必須です')
    ensureIsbnFree(input.isbn)

    const status = input.status ?? 'want'
    const now = new Date().toISOString()
    const result = db
      .prepare(
        `INSERT INTO books
           (title, authors, isbn, pages, cover, genre, status, current_page, rating, review, added_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.authors ? JSON.stringify(input.authors) : null,
        input.isbn ?? null,
        input.pages ?? null,
        input.cover ?? null,
        input.genre ?? null,
        status,
        input.current_page ?? null,
        input.rating ?? 0,
        input.review ?? null,
        now,
        status === 'done' ? now : null,
      )

    return c.json(toBook(requireBook(Number(result.lastInsertRowid))), 201)
  })

  routes.get('/:id', (c) => c.json(toBook(requireBook(parseId(c.req.param('id'))))))

  routes.put('/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    const current = requireBook(id)
    const input = parseBookInput(await readJson(c.req.raw))
    if (input.isbn !== undefined) ensureIsbnFree(input.isbn, id)

    const pick = <T>(next: T | undefined, prev: T): T => (next === undefined ? prev : next)
    const status = input.status ?? current.status

    // done にしたときだけ読了日を設定し、done から戻したときは消す
    let finishedAt = current.finished_at
    if (status === 'done' && current.status !== 'done') finishedAt = new Date().toISOString()
    if (status !== 'done') finishedAt = null

    db.prepare(
      `UPDATE books SET title = ?, authors = ?, isbn = ?, pages = ?, cover = ?, genre = ?,
         status = ?, current_page = ?, rating = ?, review = ?, finished_at = ?
       WHERE id = ?`,
    ).run(
      input.title ?? current.title,
      input.authors === undefined
        ? current.authors
        : input.authors && JSON.stringify(input.authors),
      pick(input.isbn, current.isbn),
      pick(input.pages, current.pages),
      pick(input.cover, current.cover),
      pick(input.genre, current.genre),
      status,
      pick(input.current_page, current.current_page),
      input.rating === undefined ? current.rating : (input.rating ?? 0),
      pick(input.review, current.review),
      finishedAt,
      id,
    )

    return c.json(toBook(requireBook(id)))
  })

  routes.delete('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    requireBook(id)
    db.prepare('DELETE FROM books WHERE id = ?').run(id)
    return c.body(null, 204)
  })

  return routes
}
