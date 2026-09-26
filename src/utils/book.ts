import type { Book, BookStatus } from '@/api/books'

export const STATUS_LABELS: Record<BookStatus, string> = {
  want: '読みたい',
  reading: '読書中',
  done: '読了',
}

export const STATUS_CLASSES: Record<BookStatus, string> = {
  want: 'bg-stone-100 text-stone-700',
  reading: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
}

/** 状態の選択肢（表示順）。 */
export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as BookStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}))

/** 読書の進捗。総ページ数か現在のページが未入力なら null。割合は100%を超えない。 */
export function progressOf(book: Pick<Book, 'pages' | 'current_page'>) {
  const { pages, current_page: current } = book
  if (!pages || current === null) return null
  return { current, pages, percent: Math.min(100, Math.round((current / pages) * 100)) }
}

/** シリーズの表示（例: ONE PIECE 3巻）。シリーズ未設定なら null。 */
export function seriesLabel(book: Pick<Book, 'series' | 'volume'>): string | null {
  if (!book.series) return null
  return book.volume === null ? book.series : `${book.series} ${book.volume}巻`
}

/** カンマ・読点で区切った入力を、前後の空白を除いた重複なしの配列にする（著者・タグの入力欄用）。 */
export function splitList(text: string): string[] {
  const values = text
    .split(/[,、，]/)
    .map((v) => v.trim())
    .filter((v) => v !== '')
  return [...new Set(values)]
}

/**
 * 登録日から今日までの経過日数（ブラウザのタイムゾーンでの日付の差）。当日登録は0。
 * 不正な値や未来の日時なら null。
 */
export function daysSince(iso: string, now: Date = new Date()): number | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  // 時刻を切り捨てて日付だけで比べる（UTC換算で差を取り、夏時間のずれを避ける）
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today - start) / 86_400_000)
  return days < 0 ? null : days
}

/** ISO 8601 の日時を、ブラウザのタイムゾーンでの日付（例: 2026/9/21）にする。 */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ja-JP')
}
