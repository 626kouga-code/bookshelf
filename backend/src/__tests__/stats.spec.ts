import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { openDb, type Db } from '../db.ts'

/** 今日から `offsetDays` 日前の日付（YYYY-MM-DD、UTC）。 */
function dateOffset(offsetDays: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

describe('stats API', () => {
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

  it('本がなければすべて0・空で返す', async () => {
    const res = await send('GET', '/api/stats')
    const stats = await res.json()

    expect(stats.monthly_finished).toHaveLength(12)
    expect(stats.monthly_finished.every((m: { count: number }) => m.count === 0)).toBe(true)
    expect(stats.genre_counts).toEqual([])
    expect(stats.total_pages_read).toBe(0)
    expect(stats.current_streak_days).toBe(0)
  })

  it('当月に読了した本を月別読了数に数える', async () => {
    await createBook({ title: '本', status: 'done' })
    const res = await send('GET', '/api/stats')
    const stats = await res.json()

    const thisMonth = stats.monthly_finished[stats.monthly_finished.length - 1]
    expect(thisMonth.count).toBe(1)
  })

  it('ジャンル別に冊数を集計する（未設定は null）', async () => {
    await createBook({ title: 'a', genre: '小説' })
    await createBook({ title: 'b', genre: '小説' })
    await createBook({ title: 'c', genre: '技術書' })
    await createBook({ title: 'd' })

    const res = await send('GET', '/api/stats')
    const stats = await res.json()

    expect(stats.genre_counts).toEqual(
      expect.arrayContaining([
        { genre: '小説', count: 2 },
        { genre: '技術書', count: 1 },
        { genre: null, count: 1 },
      ]),
    )
  })

  it('読書ログの累計ページ数を合計する', async () => {
    const book = await createBook()
    await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(1), pages: 30 })
    await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(0), pages: 20 })

    const res = await send('GET', '/api/stats')
    expect((await res.json()).total_pages_read).toBe(50)
  })

  describe('連続読書日数', () => {
    it('今日から連続している日数を数える', async () => {
      const book = await createBook()
      await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(0), pages: 10 })
      await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(1), pages: 10 })
      await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(2), pages: 10 })
      // 4日前は記録がなく、連続が途切れる
      await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(4), pages: 10 })

      const res = await send('GET', '/api/stats')
      expect((await res.json()).current_streak_days).toBe(3)
    })

    it('昨日までの記録なら、そこから遡って数える', async () => {
      const book = await createBook()
      await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(1), pages: 10 })
      await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(2), pages: 10 })

      const res = await send('GET', '/api/stats')
      expect((await res.json()).current_streak_days).toBe(2)
    })

    it('一昨日以前が最後なら0', async () => {
      const book = await createBook()
      await send('POST', `/api/books/${book.id}/logs`, { date: dateOffset(2), pages: 10 })

      const res = await send('GET', '/api/stats')
      expect((await res.json()).current_streak_days).toBe(0)
    })

    it('記録がなければ0', async () => {
      const res = await send('GET', '/api/stats')
      expect((await res.json()).current_streak_days).toBe(0)
    })
  })
})
