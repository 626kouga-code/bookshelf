import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { openDb, type Db } from '../db.ts'

const ISBN13 = '9780306406157'

describe('books API', () => {
  let db: Db
  let app: ReturnType<typeof createApp>

  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  const create = async (body: Record<string, unknown> = { title: '本' }) => {
    const res = await send('POST', '/api/books', body)
    return { res, book: await res.json() }
  }

  beforeEach(() => {
    db = openDb(':memory:')
    app = createApp(db)
  })

  describe('POST /api/books', () => {
    it('最小限の項目で登録でき、既定値が入る', async () => {
      const { res, book } = await create({ title: '  吾輩は猫である  ' })
      expect(res.status).toBe(201)
      expect(book).toMatchObject({
        title: '吾輩は猫である',
        authors: [],
        isbn: null,
        status: 'want',
        rating: 0,
        finished_at: null,
      })
      expect(typeof book.id).toBe('number')
      expect(new Date(book.added_at).toString()).not.toBe('Invalid Date')
    })

    it('全項目を登録でき、ISBNは13桁に正規化される', async () => {
      const { res, book } = await create({
        title: 'SICP',
        authors: ['Abelson', ' Sussman ', ''],
        isbn: '0-306-40615-2',
        pages: 657,
        cover: 'https://example.com/c.jpg',
        genre: '技術書',
        status: 'reading',
        current_page: 10,
        rating: 4,
        review: 'メモ',
      })
      expect(res.status).toBe(201)
      expect(book).toMatchObject({
        authors: ['Abelson', 'Sussman'],
        isbn: ISBN13,
        pages: 657,
        genre: '技術書',
        status: 'reading',
        current_page: 10,
        rating: 4,
        review: 'メモ',
      })
    })

    it('done で登録すると finished_at が設定される', async () => {
      const { book } = await create({ title: '読了済み', status: 'done' })
      expect(book.finished_at).toBe(book.added_at)
    })

    it('同じISBNは409（10桁と13桁の表記違いでも重複扱い）', async () => {
      await create({ title: 'a', isbn: ISBN13 })
      const { res, book } = await create({ title: 'b', isbn: '0306406152' })
      expect(res.status).toBe(409)
      expect(book).toEqual({ error: expect.any(String) })
    })

    it('ISBN未入力の本は複数登録できる', async () => {
      expect((await create({ title: 'a' })).res.status).toBe(201)
      expect((await create({ title: 'b', isbn: '' })).res.status).toBe(201)
    })

    it.each([
      ['title がない', {}],
      ['title が空白', { title: '  ' }],
      ['title が文字列でない', { title: 1 }],
      ['status が不正', { title: 'a', status: 'unknown' }],
      ['rating が範囲外', { title: 'a', rating: 6 }],
      ['rating が小数', { title: 'a', rating: 1.5 }],
      ['pages が0', { title: 'a', pages: 0 }],
      ['current_page が負', { title: 'a', current_page: -1 }],
      ['authors が配列でない', { title: 'a', authors: 'x' }],
      ['authors に文字列以外', { title: 'a', authors: [1] }],
      ['isbn の形式が不正', { title: 'a', isbn: '123' }],
      ['isbn のチェックデジットが不正', { title: 'a', isbn: '9780306406158' }],
      ['genre が文字列でない', { title: 'a', genre: 1 }],
    ])('%s場合は400', async (_name, body) => {
      const { res, book } = await create(body)
      expect(res.status).toBe(400)
      expect(book).toEqual({ error: expect.any(String) })
    })

    it('JSONでないボディは400', async () => {
      const res = await app.request('/api/books', { method: 'POST', body: 'not json' })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: expect.any(String) })
    })

    it('JSONオブジェクトでないボディは400', async () => {
      expect((await send('POST', '/api/books', [1])).status).toBe(400)
      expect((await send('POST', '/api/books', null)).status).toBe(400)
    })
  })

  describe('GET /api/books/:id', () => {
    it('登録した本を取得できる', async () => {
      const { book } = await create({ title: 'a', authors: ['x'] })
      const res = await send('GET', `/api/books/${book.id}`)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(book)
    })

    it('存在しないIDは404', async () => {
      const res = await send('GET', '/api/books/999')
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: expect.any(String) })
    })

    it('IDが数値でなければ400', async () => {
      expect((await send('GET', '/api/books/abc')).status).toBe(400)
    })
  })

  describe('PUT /api/books/:id', () => {
    it('送った項目だけ更新し、他は保持する', async () => {
      const { book } = await create({ title: 'a', genre: '小説', pages: 100 })
      const res = await send('PUT', `/api/books/${book.id}`, { title: 'b', current_page: 30 })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({
        id: book.id,
        title: 'b',
        genre: '小説',
        pages: 100,
        current_page: 30,
        added_at: book.added_at,
      })
    })

    it('null や空文字で項目を消せる', async () => {
      const { book } = await create({ title: 'a', authors: ['x'], genre: '小説', isbn: ISBN13 })
      const res = await send('PUT', `/api/books/${book.id}`, {
        authors: null,
        genre: '',
        isbn: null,
      })
      expect(await res.json()).toMatchObject({ authors: [], genre: null, isbn: null })
    })

    it('done に更新すると finished_at が設定される', async () => {
      const { book } = await create({ title: 'a', status: 'reading' })
      const res = await send('PUT', `/api/books/${book.id}`, { status: 'done' })
      const updated = await res.json()
      expect(updated.status).toBe('done')
      expect(new Date(updated.finished_at).toString()).not.toBe('Invalid Date')
    })

    it('done のまま他の項目を更新しても finished_at は変わらない', async () => {
      const { book } = await create({ title: 'a', status: 'done' })
      db.prepare('UPDATE books SET finished_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', book.id)
      const res = await send('PUT', `/api/books/${book.id}`, { review: '良かった' })
      expect(await res.json()).toMatchObject({
        finished_at: '2020-01-01T00:00:00.000Z',
        review: '良かった',
      })
    })

    it('done から戻すと finished_at が消える', async () => {
      const { book } = await create({ title: 'a', status: 'done' })
      const res = await send('PUT', `/api/books/${book.id}`, { status: 'reading' })
      expect(await res.json()).toMatchObject({ status: 'reading', finished_at: null })
    })

    it('自分自身と同じISBNへの更新は許可される', async () => {
      const { book } = await create({ title: 'a', isbn: ISBN13 })
      const res = await send('PUT', `/api/books/${book.id}`, { isbn: '0306406152', title: 'b' })
      expect(res.status).toBe(200)
    })

    it('他の本と同じISBNへの更新は409', async () => {
      await create({ title: 'a', isbn: ISBN13 })
      const { book } = await create({ title: 'b' })
      const res = await send('PUT', `/api/books/${book.id}`, { isbn: ISBN13 })
      expect(res.status).toBe(409)
    })

    it('title を空にする更新は400', async () => {
      const { book } = await create({ title: 'a' })
      expect((await send('PUT', `/api/books/${book.id}`, { title: '' })).status).toBe(400)
    })

    it('存在しないIDは404', async () => {
      expect((await send('PUT', '/api/books/999', { title: 'a' })).status).toBe(404)
    })
  })

  describe('DELETE /api/books/:id', () => {
    it('削除すると取得できなくなる', async () => {
      const { book } = await create()
      const res = await send('DELETE', `/api/books/${book.id}`)
      expect(res.status).toBe(204)
      expect((await send('GET', `/api/books/${book.id}`)).status).toBe(404)
    })

    it('読書ログと引用も連動して削除される', async () => {
      const { book } = await create()
      db.prepare("INSERT INTO reading_logs (book_id, date, pages) VALUES (?, '2026-01-01', 10)").run(book.id)
      db.prepare("INSERT INTO quotes (book_id, text) VALUES (?, 'q')").run(book.id)
      await send('DELETE', `/api/books/${book.id}`)
      expect(db.prepare('SELECT COUNT(*) AS n FROM reading_logs').get()).toEqual({ n: 0 })
      expect(db.prepare('SELECT COUNT(*) AS n FROM quotes').get()).toEqual({ n: 0 })
    })

    it('存在しないIDは404', async () => {
      expect((await send('DELETE', '/api/books/999')).status).toBe(404)
    })
  })
})
