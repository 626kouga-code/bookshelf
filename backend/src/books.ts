import { Hono } from 'hono'
import type { Db } from './db.ts'
import { ApiError } from './errors.ts'
import { normalizeIsbn } from './isbn.ts'

const STATUSES = ['want', 'reading', 'done'] as const
type Status = (typeof STATUSES)[number]

export interface BookRow {
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
  favorite: number
  tags: string | null
  series: string | null
  volume: number | null
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
  favorite?: boolean
  tags?: string[] | null
  series?: string | null
  volume?: number | null
}

/** DBの行をAPIの形にする（JSONで保存した配列を戻し、favorite を真偽値にする）。 */
export function toBook(row: BookRow) {
  return {
    ...row,
    authors: row.authors ? (JSON.parse(row.authors) as string[]) : [],
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    favorite: row.favorite === 1,
  }
}

/** 配列をJSONにして保存する。空・未設定は null。 */
function toJsonArray(values: string[] | null | undefined): string | null {
  return values && values.length ? JSON.stringify(values) : null
}

/** 文字列の配列を検証し、前後の空白を除いて空要素を捨てる。`unique` なら重複も除く。 */
function optionalStringArray(
  body: Record<string, unknown>,
  key: string,
  unique = false,
): string[] | null | undefined {
  const v = body[key]
  if (v === undefined || v === null) return v
  if (!Array.isArray(v) || v.some((a) => typeof a !== 'string')) {
    throw new ApiError(400, `${key} は文字列の配列で指定してください`)
  }
  const values = (v as string[]).map((a) => a.trim()).filter((a) => a !== '')
  return unique ? [...new Set(values)] : values
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

  const authors = optionalStringArray(body, 'authors')
  if (authors !== undefined) input.authors = authors
  const tags = optionalStringArray(body, 'tags', true)
  if (tags !== undefined) input.tags = tags

  if (body.favorite !== undefined) {
    if (typeof body.favorite !== 'boolean') throw new ApiError(400, 'favorite は true / false で指定してください')
    input.favorite = body.favorite
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
    series: optionalString(body, 'series'),
    volume: optionalInt(body, 'volume', 1),
  }
  for (const [key, value] of Object.entries(optionals)) {
    if (value !== undefined) Object.assign(input, { [key]: value })
  }

  return input
}

/** 並べ替えに使える項目（クエリの `sort` → 列名）。 */
const SORT_COLUMNS = {
  added_at: 'added_at',
  title: 'title',
  rating: 'rating',
  finished_at: 'finished_at',
  series: 'series',
} as const
type SortKey = keyof typeof SORT_COLUMNS

interface ListQuery {
  status?: Status
  genre?: string
  rating?: number
  author?: string
  tag?: string
  series?: string
  favorite?: boolean
  q?: string
  sort: SortKey
  order: 'asc' | 'desc'
}

/** `GET /api/books` のクエリパラメータを検証する。空文字は「指定なし」として扱う。 */
function parseListQuery(query: Record<string, string>): ListQuery {
  const get = (key: string) => (query[key] === undefined || query[key] === '' ? undefined : query[key])

  const status = get('status')
  if (status !== undefined && !STATUSES.includes(status as Status)) {
    throw new ApiError(400, `status は ${STATUSES.join(' / ')} のいずれかで指定してください`)
  }

  const ratingText = get('rating')
  let rating: number | undefined
  if (ratingText !== undefined) {
    rating = Number(ratingText)
    if (!/^\d+$/.test(ratingText) || rating > 5) {
      throw new ApiError(400, 'rating は 0〜5 の整数で指定してください')
    }
  }

  const favorite = get('favorite')
  if (favorite !== undefined && favorite !== 'true' && favorite !== 'false') {
    throw new ApiError(400, 'favorite は true / false のいずれかで指定してください')
  }

  const sort = get('sort') ?? 'added_at'
  if (!(sort in SORT_COLUMNS)) {
    throw new ApiError(400, `sort は ${Object.keys(SORT_COLUMNS).join(' / ')} のいずれかで指定してください`)
  }

  const order = get('order') ?? 'desc'
  if (order !== 'asc' && order !== 'desc') {
    throw new ApiError(400, 'order は asc / desc のいずれかで指定してください')
  }

  return {
    status: status as Status | undefined,
    genre: get('genre'),
    rating,
    author: get('author'),
    tag: get('tag'),
    series: get('series'),
    favorite: favorite === undefined ? undefined : favorite === 'true',
    q: get('q'),
    sort: sort as SortKey,
    order,
  }
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
           (title, authors, isbn, pages, cover, genre, status, current_page, rating, review, added_at, finished_at,
            favorite, tags, series, volume)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        toJsonArray(input.authors),
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
        input.favorite ? 1 : 0,
        toJsonArray(input.tags),
        input.series ?? null,
        input.volume ?? null,
      )

    return c.json(toBook(requireBook(Number(result.lastInsertRowid))), 201)
  })

  routes.get('/', (c) => {
    const q = parseListQuery(c.req.query())
    const where: string[] = []
    const params: (string | number)[] = []

    if (q.status) {
      where.push('status = ?')
      params.push(q.status)
    }
    if (q.genre) {
      where.push('genre = ?')
      params.push(q.genre)
    }
    if (q.rating !== undefined) {
      where.push('rating = ?')
      params.push(q.rating)
    }
    if (q.author) {
      where.push('EXISTS (SELECT 1 FROM json_each(books.authors) WHERE value = ?)')
      params.push(q.author)
    }
    if (q.tag) {
      where.push('EXISTS (SELECT 1 FROM json_each(books.tags) WHERE value = ?)')
      params.push(q.tag)
    }
    if (q.series) {
      where.push('series = ?')
      params.push(q.series)
    }
    if (q.favorite !== undefined) {
      where.push('favorite = ?')
      params.push(q.favorite ? 1 : 0)
    }
    if (q.q) {
      const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`
      where.push(
        `(title LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM json_each(books.authors) WHERE value LIKE ? ESCAPE '\\'))`,
      )
      params.push(like, like)
    }

    const column = SORT_COLUMNS[q.sort]
    const collate = q.sort === 'title' || q.sort === 'series' ? ' COLLATE NOCASE' : ''
    // シリーズ順は、同じシリーズの中を巻数順に並べる（巻数なしは後ろ）
    const volumeOrder = q.sort === 'series' ? `volume IS NULL, volume ${q.order}, ` : ''
    const sql = `SELECT * FROM books
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${column} IS NULL, ${column}${collate} ${q.order}, ${volumeOrder}id ${q.order}`

    return c.json((db.prepare(sql).all(...params) as BookRow[]).map(toBook))
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
         status = ?, current_page = ?, rating = ?, review = ?, finished_at = ?,
         favorite = ?, tags = ?, series = ?, volume = ?
       WHERE id = ?`,
    ).run(
      input.title ?? current.title,
      input.authors === undefined ? current.authors : toJsonArray(input.authors),
      pick(input.isbn, current.isbn),
      pick(input.pages, current.pages),
      pick(input.cover, current.cover),
      pick(input.genre, current.genre),
      status,
      pick(input.current_page, current.current_page),
      input.rating === undefined ? current.rating : (input.rating ?? 0),
      pick(input.review, current.review),
      finishedAt,
      input.favorite === undefined ? current.favorite : input.favorite ? 1 : 0,
      input.tags === undefined ? current.tags : toJsonArray(input.tags),
      pick(input.series, current.series),
      pick(input.volume, current.volume),
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
