import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { openDb, type Db } from '../db.ts'

describe('quotes API', () => {
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

  beforeEach(() => {
    db = openDb(':memory:')
    app = createApp(db)
  })

  describe('POST /api/books/:id/quotes', () => {
    it('文章とページ番号を指定して追加できる', async () => {
      const book = await createBook()
      const res = await send('POST', `/api/books/${book.id}/quotes`, { text: '  吾輩は猫である  ', page: 12 })
      const quote = await res.json()

      expect(res.status).toBe(201)
      expect(quote).toMatchObject({ book_id: book.id, text: '吾輩は猫である', page: 12 })
      expect(typeof quote.id).toBe('number')
    })

    it('ページ番号は省略できる', async () => {
      const book = await createBook()
      const res = await send('POST', `/api/books/${book.id}/quotes`, { text: '名前がまだない' })
      const quote = await res.json()
      expect(res.status).toBe(201)
      expect(quote.page).toBeNull()
    })

    it('空文字のtextは400', async () => {
      const book = await createBook()
      const res = await send('POST', `/api/books/${book.id}/quotes`, { text: '   ' })
      expect(res.status).toBe(400)
    })

    it('不正なpageは400', async () => {
      const book = await createBook()
      const res = await send('POST', `/api/books/${book.id}/quotes`, { text: 'x', page: 0 })
      expect(res.status).toBe(400)
    })

    it('存在しない本は404', async () => {
      const res = await send('POST', '/api/books/999/quotes', { text: 'x' })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/books/:id/quotes', () => {
    it('新しい順で一覧を返す', async () => {
      const book = await createBook()
      await send('POST', `/api/books/${book.id}/quotes`, { text: '一つ目' })
      await send('POST', `/api/books/${book.id}/quotes`, { text: '二つ目' })

      const res = await send('GET', `/api/books/${book.id}/quotes`)
      const quotes = await res.json()
      expect(quotes.map((q: { text: string }) => q.text)).toEqual(['二つ目', '一つ目'])
    })

    it('存在しない本は404', async () => {
      const res = await send('GET', '/api/books/999/quotes')
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/books/:id/quotes/:quoteId', () => {
    it('削除できる', async () => {
      const book = await createBook()
      const created = await (await send('POST', `/api/books/${book.id}/quotes`, { text: '消す引用' })).json()

      const res = await send('DELETE', `/api/books/${book.id}/quotes/${created.id}`)
      expect(res.status).toBe(204)

      const list = await (await send('GET', `/api/books/${book.id}/quotes`)).json()
      expect(list).toEqual([])
    })

    it('存在しない引用は404', async () => {
      const book = await createBook()
      const res = await send('DELETE', `/api/books/${book.id}/quotes/999`)
      expect(res.status).toBe(404)
    })

    it('別の本の引用IDを指定すると404', async () => {
      const bookA = await createBook({ title: 'A' })
      const bookB = await createBook({ title: 'B' })
      const created = await (await send('POST', `/api/books/${bookA.id}/quotes`, { text: 'Aの引用' })).json()

      const res = await send('DELETE', `/api/books/${bookB.id}/quotes/${created.id}`)
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/quotes', () => {
    it('キーワードで全本を横断検索できる', async () => {
      const bookA = await createBook({ title: '吾輩は猫である' })
      const bookB = await createBook({ title: '坊っちゃん' })
      await send('POST', `/api/books/${bookA.id}/quotes`, { text: '名前はまだない', page: 1 })
      await send('POST', `/api/books/${bookB.id}/quotes`, { text: '親譲りの無鉄砲' })

      const res = await send('GET', '/api/quotes?q=' + encodeURIComponent('名前'))
      const results = await res.json()
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ text: '名前はまだない', page: 1, book_id: bookA.id, book_title: '吾輩は猫である' })
    })

    it('キーワードなしなら全件を新しい順で返す', async () => {
      const book = await createBook()
      await send('POST', `/api/books/${book.id}/quotes`, { text: '一つ目' })
      await send('POST', `/api/books/${book.id}/quotes`, { text: '二つ目' })

      const res = await send('GET', '/api/quotes')
      const results = await res.json()
      expect(results.map((q: { text: string }) => q.text)).toEqual(['二つ目', '一つ目'])
    })

    it('該当なしなら空配列', async () => {
      const res = await send('GET', '/api/quotes?q=見つからない')
      expect(await res.json()).toEqual([])
    })
  })
})
