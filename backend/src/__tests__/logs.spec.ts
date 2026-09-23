import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { openDb, type Db } from '../db.ts'

describe('reading logs API', () => {
  let db: Db
  let app: ReturnType<typeof createApp>

  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  const createBook = async (body: Record<string, unknown> = { title: '本' }) => {
    const res = await send('POST', '/api/books', body)
    return (await res.json()) as { id: number }
  }

  const getBook = async (id: number) => {
    const res = await send('GET', `/api/books/${id}`)
    return (await res.json()) as { current_page: number | null; status: string }
  }

  beforeEach(() => {
    db = openDb(':memory:')
    app = createApp(db)
  })

  describe('POST /api/books/:id/logs', () => {
    it('ログを追加すると current_page に加算され、want は reading になる', async () => {
      const book = await createBook({ title: '本', pages: 300, status: 'want', current_page: 0 })

      const res = await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 30 })
      const log = await res.json()

      expect(res.status).toBe(201)
      expect(log).toMatchObject({ book_id: book.id, date: '2026-09-20', pages: 30 })
      expect(typeof log.id).toBe('number')

      const updated = await getBook(book.id)
      expect(updated.current_page).toBe(30)
      expect(updated.status).toBe('reading')
    })

    it('current_page が総ページ数を超えないように上限がかかる', async () => {
      const book = await createBook({ title: '本', pages: 100, status: 'reading', current_page: 90 })
      await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 50 })

      const updated = await getBook(book.id)
      expect(updated.current_page).toBe(100)
    })

    it('総ページ数に達しても status は自動で done にならない', async () => {
      const book = await createBook({ title: '本', pages: 10, status: 'reading', current_page: 0 })
      await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 10 })

      const updated = await getBook(book.id)
      expect(updated.status).toBe('reading')
    })

    it('同じ本・同じ日付に複数回記録できる', async () => {
      const book = await createBook({ title: '本', current_page: 0 })
      await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 10 })
      await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 15 })

      const updated = await getBook(book.id)
      expect(updated.current_page).toBe(25)
    })

    it('未来日を許可する', async () => {
      const book = await createBook({ title: '本' })
      const res = await send('POST', `/api/books/${book.id}/logs`, { date: '2999-01-01', pages: 10 })
      expect(res.status).toBe(201)
    })

    it('不正な日付やページ数は400', async () => {
      const book = await createBook({ title: '本' })
      const badDate = await send('POST', `/api/books/${book.id}/logs`, { date: '2026-13-40', pages: 10 })
      expect(badDate.status).toBe(400)
      const badPages = await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 0 })
      expect(badPages.status).toBe(400)
    })

    it('存在しない本は404', async () => {
      const res = await send('POST', '/api/books/999/logs', { date: '2026-09-20', pages: 10 })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/books/:id/logs', () => {
    it('日付の新しい順で一覧を返す', async () => {
      const book = await createBook({ title: '本' })
      await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-18', pages: 10 })
      await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 10 })
      await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-19', pages: 10 })

      const res = await send('GET', `/api/books/${book.id}/logs`)
      const logs = await res.json()
      expect(logs.map((l: { date: string }) => l.date)).toEqual(['2026-09-20', '2026-09-19', '2026-09-18'])
    })
  })

  describe('DELETE /api/books/:id/logs/:logId', () => {
    it('削除すると current_page から減算される', async () => {
      const book = await createBook({ title: '本', current_page: 0 })
      const logRes = await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 30 })
      const log = await logRes.json()

      const res = await send('DELETE', `/api/books/${book.id}/logs/${log.id}`)
      expect(res.status).toBe(204)

      const updated = await getBook(book.id)
      expect(updated.current_page).toBe(0)
    })

    it('current_page が0未満にはならない', async () => {
      const book = await createBook({ title: '本', current_page: 5 })
      const logRes = await send('POST', `/api/books/${book.id}/logs`, { date: '2026-09-20', pages: 30 })
      const log = await logRes.json()
      await send('PUT', `/api/books/${book.id}`, { current_page: 3 })

      const res = await send('DELETE', `/api/books/${book.id}/logs/${log.id}`)
      expect(res.status).toBe(204)

      const updated = await getBook(book.id)
      expect(updated.current_page).toBe(0)
    })

    it('存在しないログは404', async () => {
      const book = await createBook({ title: '本' })
      const res = await send('DELETE', `/api/books/${book.id}/logs/999`)
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/books/:id/prediction', () => {
    it('直近のペースから目安日数を算出する', async () => {
      const book = await createBook({ title: '本', pages: 300, current_page: 0 })
      const today = new Date()
      const dateStr = (offsetDays: number) => {
        const d = new Date(today)
        d.setUTCDate(d.getUTCDate() - offsetDays)
        return d.toISOString().slice(0, 10)
      }
      // 直近14日間で合計140ページ → 1日10ページペース
      for (let i = 0; i < 14; i++) {
        await send('POST', `/api/books/${book.id}/logs`, { date: dateStr(i), pages: 10 })
      }

      const res = await send('GET', `/api/books/${book.id}/prediction`)
      const prediction = await res.json()
      expect(prediction.available).toBe(true)
      expect(prediction.pagesPerDay).toBeCloseTo(10)
      expect(prediction.remainingPages).toBe(160)
      expect(prediction.estimatedDays).toBe(16)
    })

    it('ログがなければ available: false', async () => {
      const book = await createBook({ title: '本', pages: 300, current_page: 0 })
      const res = await send('GET', `/api/books/${book.id}/prediction`)
      const prediction = await res.json()
      expect(prediction.available).toBe(false)
    })

    it('総ページ数が未設定なら available: false', async () => {
      const book = await createBook({ title: '本', current_page: 0 })
      const res = await send('GET', `/api/books/${book.id}/prediction`)
      const prediction = await res.json()
      expect(prediction.available).toBe(false)
    })

    it('既に読み終わっていれば available: false', async () => {
      const book = await createBook({ title: '本', pages: 100, current_page: 100 })
      const res = await send('GET', `/api/books/${book.id}/prediction`)
      const prediction = await res.json()
      expect(prediction.available).toBe(false)
    })

    it('存在しない本は404', async () => {
      const res = await send('GET', '/api/books/999/prediction')
      expect(res.status).toBe(404)
    })
  })
})
