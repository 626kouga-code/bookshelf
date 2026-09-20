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

  describe('GET /api/books', () => {
    const list = async (query = '') => {
      const res = await send('GET', `/api/books${query}`)
      const body = await res.json()
      return { res, body, titles: Array.isArray(body) ? body.map((b: { title: string }) => b.title) : [] }
    }

    const seed = async () => {
      await create({ title: 'Vue入門', authors: ['山田'], genre: '技術書', status: 'reading', rating: 3 })
      await create({ title: 'apple', authors: ['鈴木', '山田'], genre: '小説', status: 'done', rating: 5 })
      await create({ title: 'Banana', authors: ['佐藤'], genre: '小説', status: 'want' })
      await create({ title: 'cherry', genre: '技術書', status: 'done', rating: 3 })
      // 追加日・読了日を固定して並び順を検証する
      const dates = [
        ['Vue入門', '2026-01-01T00:00:00.000Z', null],
        ['apple', '2026-01-02T00:00:00.000Z', '2026-03-01T00:00:00.000Z'],
        ['Banana', '2026-01-03T00:00:00.000Z', null],
        ['cherry', '2026-01-04T00:00:00.000Z', '2026-02-01T00:00:00.000Z'],
      ]
      for (const [title, added, finished] of dates) {
        db.prepare('UPDATE books SET added_at = ?, finished_at = ? WHERE title = ?').run(added, finished, title)
      }
    }

    it('本がなければ空配列', async () => {
      const { res, body } = await list()
      expect(res.status).toBe(200)
      expect(body).toEqual([])
    })

    it('既定は追加日の新しい順で、authors は配列で返る', async () => {
      await seed()
      const { body, titles } = await list()
      expect(titles).toEqual(['cherry', 'Banana', 'apple', 'Vue入門'])
      expect(body[2].authors).toEqual(['鈴木', '山田'])
    })

    it('状態で絞り込める', async () => {
      await seed()
      expect((await list('?status=done')).titles).toEqual(['cherry', 'apple'])
    })

    it('ジャンルで絞り込める', async () => {
      await seed()
      expect((await list(`?genre=${encodeURIComponent('小説')}`)).titles).toEqual(['Banana', 'apple'])
    })

    it('評価で絞り込める（0は未評価）', async () => {
      await seed()
      expect((await list('?rating=3')).titles).toEqual(['cherry', 'Vue入門'])
      expect((await list('?rating=0')).titles).toEqual(['Banana'])
    })

    it('著者で絞り込める（完全一致・複数著者のどれか）', async () => {
      await seed()
      expect((await list(`?author=${encodeURIComponent('山田')}`)).titles).toEqual(['apple', 'Vue入門'])
      expect((await list(`?author=${encodeURIComponent('山')}`)).titles).toEqual([])
    })

    it('条件は AND で組み合わせられる', async () => {
      await seed()
      const query = `?status=done&genre=${encodeURIComponent('小説')}&rating=5`
      expect((await list(query)).titles).toEqual(['apple'])
    })

    it('キーワードでタイトルを部分一致検索できる（大文字小文字を区別しない）', async () => {
      await seed()
      expect((await list('?q=AN')).titles).toEqual(['Banana'])
      expect((await list(`?q=${encodeURIComponent('入門')}`)).titles).toEqual(['Vue入門'])
    })

    it('キーワードで著者も部分一致検索できる', async () => {
      await seed()
      expect((await list(`?q=${encodeURIComponent('山')}`)).titles).toEqual(['apple', 'Vue入門'])
    })

    it('キーワードの % や _ はワイルドカードにならない', async () => {
      await seed()
      await create({ title: '100%完全ガイド' })
      expect((await list('?q=%25')).titles).toEqual(['100%完全ガイド'])
      expect((await list('?q=_')).titles).toEqual([])
    })

    it('タイトル順に並べ替えられる（大文字小文字を区別しない）', async () => {
      await seed()
      expect((await list('?sort=title&order=asc')).titles).toEqual(['apple', 'Banana', 'cherry', 'Vue入門'])
    })

    it('評価順に並べ替えられる', async () => {
      await seed()
      expect((await list('?sort=rating&order=desc')).titles).toEqual(['apple', 'cherry', 'Vue入門', 'Banana'])
    })

    it('読了日順では未読了の本は昇順・降順どちらでも末尾', async () => {
      await seed()
      expect((await list('?sort=finished_at&order=asc')).titles).toEqual(['cherry', 'apple', 'Vue入門', 'Banana'])
      expect((await list('?sort=finished_at&order=desc')).titles).toEqual(['apple', 'cherry', 'Banana', 'Vue入門'])
    })

    it('追加日の昇順に並べ替えられる', async () => {
      await seed()
      expect((await list('?sort=added_at&order=asc')).titles).toEqual(['Vue入門', 'apple', 'Banana', 'cherry'])
    })

    it('空のクエリパラメータは指定なしとして扱う', async () => {
      await seed()
      expect((await list('?status=&genre=&q=&sort=&order=')).titles).toHaveLength(4)
    })

    it.each([
      ['status が不正', '?status=unknown'],
      ['rating が範囲外', '?rating=6'],
      ['rating が数値でない', '?rating=abc'],
      ['rating が負', '?rating=-1'],
      ['sort が不正', '?sort=pages'],
      ['sort が列名の注入', '?sort=id;DROP TABLE books'],
      ['order が不正', '?order=up'],
    ])('%s場合は400', async (_name, query) => {
      const { res, body } = await list(query)
      expect(res.status).toBe(400)
      expect(body).toEqual({ error: expect.any(String) })
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
