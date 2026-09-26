import { request } from './client'

export interface MonthlyFinished {
  month: string
  count: number
}

export interface GenreCount {
  genre: string | null
  count: number
}

/** 1日に読んだページ数（date は YYYY-MM-DD）。 */
export interface DailyPages {
  date: string
  pages: number
}

export interface Stats {
  monthly_finished: MonthlyFinished[]
  genre_counts: GenreCount[]
  total_pages_read: number
  current_streak_days: number
  /** 直近53週の日別ページ数。記録がある日だけを日付順に含む。 */
  daily_pages: DailyPages[]
}

export function getStats(): Promise<Stats> {
  return request<Stats>('/api/stats')
}

export type GoalPeriodType = 'year' | 'month'

export interface Goal {
  period_type: GoalPeriodType
  period: string
  target_books: number | null
  target_daily_pages: number | null
}

/**
 * 目標の書き込み項目。未指定の項目は変更されず、null を送るとその項目が未設定に戻る。
 */
export interface GoalInput {
  target_books?: number | null
  target_daily_pages?: number | null
}

/** period を省略すると、サーバー側で現在の年・月を対象にする。 */
export function getGoal(periodType: GoalPeriodType, period?: string): Promise<Goal> {
  const query = new URLSearchParams({ period_type: periodType })
  if (period) query.set('period', period)
  return request<Goal>(`/api/goals?${query.toString()}`)
}

export function updateGoal(periodType: GoalPeriodType, period: string | undefined, input: GoalInput): Promise<Goal> {
  const query = new URLSearchParams({ period_type: periodType })
  if (period) query.set('period', period)
  return request<Goal>(`/api/goals?${query.toString()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
