import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { openDb, type Db } from '../db.ts'

describe('backup API', () => {
  let db: Db
  let app: ReturnType<typeof createApp>

  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  const json = async (res: Response) => (await res.json()) as Record<string, unknown>

  beforeEach(() => {
    db = openDb(':memory:')
    app = createApp(db)
  })

  describe('GET /api/export', () => {
    it('空の状態ではすべて空配列で返す', async () => {
      const res = await send('GET', '/api/export')
      const body = await json(res)
      expect(res.status).toBe(200)
      expect(body).toMatchObject({ version: 1, books: [], reading_logs: [], quotes: [], goals: [] })
      expect(typeof body.exported_at).toBe('string')
    })

    it('本・ログ・引用・目標をエクスポートする', async () => {
      const bookRes = await send('POST', '/api/books', { title: '本', authors: ['著者'], pages: 100 })
      const book = await json(bookRes)
      await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 10 })
      await send('POST', `/api/books/${book.id}/quotes`, { text: '引用', page: 5 })
      await send('PUT', '/api/goals?period_type=year&period=2026', { target_books: 24 })

      const body = await json(await send('GET', '/api/export'))
      const books = body.books as Record<string, unknown>[]
      expect(books).toHaveLength(1)
      expect(books[0]).toMatchObject({ id: book.id, title: '本', authors: ['著者'] })
      expect(body.reading_logs).toHaveLength(1)
      expect(body.quotes).toHaveLength(1)
      expect(body.goals).toHaveLength(1)
    })
  })

  describe('POST /api/import', () => {
    const validPayload = () => ({
      version: 1,
      exported_at: '2026-09-23T00:00:00.000Z',
      books: [
        {
          id: 10,
          title: '本A',
          authors: ['著者A'],
          isbn: null,
          pages: 200,
          cover: null,
          genre: '小説',
          status: 'reading',
          current_page: 50,
          rating: 4,
          review: null,
          added_at: '2026-01-01T00:00:00.000Z',
          finished_at: null,
        },
      ],
      reading_logs: [{ id: 20, book_id: 10, date: '2026-09-20', pages: 30 }],
      quotes: [{ id: 30, book_id: 10, text: '引用文', page: 12 }],
      goals: [{ id: 40, period_type: 'year', period: '2026', target_books: 24, target_daily_pages: null }],
    })

    it('正常な形式で置き換え、件数を返す', async () => {
      const res = await send('POST', '/api/import', validPayload())
      expect(res.status).toBe(200)
      expect(await json(res)).toEqual({ books: 1, reading_logs: 1, quotes: 1, goals: 1 })

      const book = await json(await send('GET', '/api/books/10'))
      expect(book).toMatchObject({ title: '本A', authors: ['著者A'], current_page: 50 })
      const logs = await json(await send('GET', '/api/books/10/logs'))
      expect(logs).toEqual([{ id: 20, book_id: 10, date: '2026-09-20', pages: 30 }])
    })

    it('既存データがある状態でインポートすると完全に置き換わる', async () => {
      const oldBook = await json(await send('POST', '/api/books', { title: '古い本' }))
      await send('PUT', '/api/goals?period_type=month&period=2026-01', { target_books: 1 })

      await send('POST', '/api/import', validPayload())

      const books = (await (await send('GET', '/api/books')).json()) as Record<string, unknown>[]
      expect(books).toHaveLength(1)
      expect(books[0]!.id).toBe(10)
      const oldGetRes = await send('GET', `/api/books/${oldBook.id}`)
      expect(oldGetRes.status).toBe(404)
    })

    it('インポート後に新しい本を追加してもIDが衝突しない', async () => {
      await send('POST', '/api/import', validPayload())
      const res = await send('POST', '/api/books', { title: '新しい本' })
      const newBook = await json(res)
      expect(res.status).toBe(201)
      expect(newBook.id).not.toBe(10)
      // 既存の本（id=10）が上書きされていないことを確認
      const existing = await json(await send('GET', '/api/books/10'))
      expect(existing.title).toBe('本A')
    })

    it('空のデータでインポートすると全部消える', async () => {
      await send('POST', '/api/books', { title: '消える本' })
      const res = await send('POST', '/api/import', {
        version: 1,
        exported_at: '2026-09-23T00:00:00.000Z',
        books: [],
        reading_logs: [],
        quotes: [],
        goals: [],
      })
      expect(await json(res)).toEqual({ books: 0, reading_logs: 0, quotes: 0, goals: 0 })
      expect(await json(await send('GET', '/api/books'))).toEqual([])
    })

    describe('検証エラー（既存データが変化しないことも確認する）', () => {
      const expectRejected = async (mutate: (p: ReturnType<typeof validPayload>) => unknown) => {
        const before = await json(await send('POST', '/api/books', { title: '保持される本' }))
        const payload = validPayload()
        const res = await send('POST', '/api/import', mutate(payload) ?? payload)
        expect(res.status).toBe(400)
        const after = await json(await send('GET', `/api/books/${before.id}`))
        expect(after.title).toBe('保持される本')
      }

      it('version が1以外なら400', async () => {
        await expectRejected((p) => ({ ...p, version: 2 }))
      })

      it('books が配列でなければ400', async () => {
        await expectRejected((p) => ({ ...p, books: {} }))
      })

      it('不正な status なら400', async () => {
        await expectRejected((p) => {
          p.books[0]!.status = 'unknown' as never
          return p
        })
      })

      it('reading_logs.book_id が books に存在しなければ400', async () => {
        await expectRejected((p) => {
          p.reading_logs[0]!.book_id = 999
          return p
        })
      })

      it('quotes.book_id が books に存在しなければ400', async () => {
        await expectRejected((p) => {
          p.quotes[0]!.book_id = 999
          return p
        })
      })

      it('books.id が重複していれば400', async () => {
        await expectRejected((p) => ({ ...p, books: [...p.books, { ...p.books[0]! }] }))
      })

      it('goals の period_type・period が重複していれば400', async () => {
        await expectRejected((p) => ({ ...p, goals: [...p.goals, { ...p.goals[0]!, id: 41 }] }))
      })

      it('不正な period_type なら400', async () => {
        await expectRejected((p) => {
          p.goals[0]!.period_type = 'day' as never
          return p
        })
      })

      it('不正な日付形式なら400', async () => {
        await expectRejected((p) => {
          p.reading_logs[0]!.date = '2026/09/20'
          return p
        })
      })
    })
  })
})
