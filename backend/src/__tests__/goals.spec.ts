import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { openDb, type Db } from '../db.ts'

describe('goals API', () => {
  let db: Db
  let app: ReturnType<typeof createApp>

  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  beforeEach(() => {
    db = openDb(':memory:')
    app = createApp(db)
  })

  describe('GET /api/goals', () => {
    it('未設定なら null の状態で返す', async () => {
      const res = await send('GET', '/api/goals?period_type=year&period=2026')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        period_type: 'year',
        period: '2026',
        target_books: null,
        target_daily_pages: null,
      })
    })

    it('period を省略すると現在の年・月を使う', async () => {
      const now = new Date()
      const year = String(now.getFullYear())
      const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const yearRes = await send('GET', '/api/goals?period_type=year')
      expect((await yearRes.json()).period).toBe(year)

      const monthRes = await send('GET', '/api/goals?period_type=month')
      expect((await monthRes.json()).period).toBe(month)
    })

    it('period_type が不正なら400', async () => {
      const res = await send('GET', '/api/goals?period_type=day')
      expect(res.status).toBe(400)
    })

    it('period の形式が不正なら400', async () => {
      const res = await send('GET', '/api/goals?period_type=year&period=26')
      expect(res.status).toBe(400)
      const res2 = await send('GET', '/api/goals?period_type=month&period=2026-13')
      expect(res2.status).toBe(400)
    })
  })

  describe('PUT /api/goals', () => {
    it('新規作成できる', async () => {
      const res = await send('PUT', '/api/goals?period_type=year&period=2026', {
        target_books: 24,
        target_daily_pages: 20,
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ target_books: 24, target_daily_pages: 20 })
    })

    it('既存の目標を部分更新できる（未指定の項目は変更しない）', async () => {
      await send('PUT', '/api/goals?period_type=year&period=2026', { target_books: 24, target_daily_pages: 20 })
      const res = await send('PUT', '/api/goals?period_type=year&period=2026', { target_books: 30 })
      expect(await res.json()).toMatchObject({ target_books: 30, target_daily_pages: 20 })
    })

    it('null を送ると未設定に戻せる', async () => {
      await send('PUT', '/api/goals?period_type=year&period=2026', { target_books: 24, target_daily_pages: 20 })
      const res = await send('PUT', '/api/goals?period_type=year&period=2026', { target_daily_pages: null })
      expect(await res.json()).toMatchObject({ target_books: 24, target_daily_pages: null })
    })

    it('年と月は別の目標として管理される', async () => {
      await send('PUT', '/api/goals?period_type=year&period=2026', { target_books: 24 })
      await send('PUT', '/api/goals?period_type=month&period=2026-09', { target_books: 2 })

      const year = await (await send('GET', '/api/goals?period_type=year&period=2026')).json()
      const month = await (await send('GET', '/api/goals?period_type=month&period=2026-09')).json()
      expect(year.target_books).toBe(24)
      expect(month.target_books).toBe(2)
    })

    it('不正な値は400', async () => {
      const res = await send('PUT', '/api/goals?period_type=year&period=2026', { target_books: 0 })
      expect(res.status).toBe(400)
    })
  })
})
