import type { Book, BookStatus } from '@/api/books'

export const STATUS_LABELS: Record<BookStatus, string> = {
  want: '読みたい',
  reading: '読書中',
  done: '読了',
}

export const STATUS_CLASSES: Record<BookStatus, string> = {
  want: 'bg-stone-100 text-stone-700',
  reading: 'bg-sky-100 text-sky-800',
  done: 'bg-emerald-100 text-emerald-800',
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

/** ISO 8601 の日時を、ブラウザのタイムゾーンでの日付（例: 2026/9/21）にする。 */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ja-JP')
}
