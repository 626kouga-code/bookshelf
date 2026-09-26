import { Hono } from 'hono'
import type { Db } from './db.ts'

const MONTHS_IN_WINDOW = 12

/** 直近12ヶ月（当月含む）の月別読了冊数。読んだ本がない月も0件として含める。 */
function monthlyFinished(db: Db): { month: string; count: number }[] {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', finished_at) AS month, COUNT(*) AS count
         FROM books WHERE finished_at IS NOT NULL
         GROUP BY month`,
    )
    .all() as { month: string; count: number }[]
  const counts = new Map(rows.map((r) => [r.month, r.count]))

  const now = new Date()
  const months: { month: string; count: number }[] = []
  for (let i = MONTHS_IN_WINDOW - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    months.push({ month: key, count: counts.get(key) ?? 0 })
  }
  return months
}

/** ジャンル別の冊数。ジャンル未設定は genre: null としてまとめる。 */
function genreCounts(db: Db): { genre: string | null; count: number }[] {
  return db
    .prepare('SELECT genre, COUNT(*) AS count FROM books GROUP BY genre ORDER BY count DESC')
    .all() as { genre: string | null; count: number }[]
}

/** 読書ログの累計ページ数。 */
function totalPagesRead(db: Db): number {
  const row = db.prepare('SELECT COALESCE(SUM(pages), 0) AS total FROM reading_logs').get() as { total: number }
  return row.total
}

/** ヒートマップ用に返す期間（日数）。53週分あれば、週の途中から始まるカレンダーも埋まる。 */
const HEATMAP_DAYS = 53 * 7

/** 直近53週の日別の読書ページ数（ヒートマップ用）。記録がある日だけを日付順に返す。 */
function dailyPages(db: Db): { date: string; pages: number }[] {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - (HEATMAP_DAYS - 1))
  return db
    .prepare(
      `SELECT date, COALESCE(SUM(pages), 0) AS pages
         FROM reading_logs WHERE date >= ?
         GROUP BY date ORDER BY date`,
    )
    .all(since.toISOString().slice(0, 10)) as { date: string; pages: number }[]
}

/** 直近の読書ログの日から遡って連続して記録がある日数。今日・昨日に記録がなければ0。 */
function currentStreakDays(db: Db): number {
  const rows = db.prepare('SELECT DISTINCT date FROM reading_logs ORDER BY date DESC').all() as {
    date: string
  }[]
  if (rows.length === 0) return 0

  const dates = new Set(rows.map((r) => r.date))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)

  const mostRecent = rows[0]!.date
  if (mostRecent !== fmt(today) && mostRecent !== fmt(yesterday)) return 0

  let streak = 0
  const cursor = new Date(`${mostRecent}T00:00:00Z`)
  while (dates.has(fmt(cursor))) {
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

export function statsRoutes(db: Db) {
  const routes = new Hono()

  routes.get('/', (c) =>
    c.json({
      monthly_finished: monthlyFinished(db),
      genre_counts: genreCounts(db),
      total_pages_read: totalPagesRead(db),
      current_streak_days: currentStreakDays(db),
      daily_pages: dailyPages(db),
    }),
  )

  return routes
}
