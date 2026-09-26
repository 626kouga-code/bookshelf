import type { Book } from '@/api/books'
import { STATUS_LABELS } from './book'

type Cell = string | number | null

/** 表計算ソフトで数式として解釈されうる先頭文字（CSVインジェクション対策）。 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

/**
 * CSVの1セル分の文字列にする。
 * 先頭が数式になりうる文字列は ' を付けて文字列として扱わせ、カンマ・ダブルクォート・改行を含むものは "..." で囲む。
 */
export function csvCell(value: Cell): string {
  if (value === null) return ''
  let text = String(value)
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** 行の配列をCSVにする。Excelで文字化けしないよう先頭にBOMを付け、改行はCRLFにする。 */
export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** ISO 8601 の日時を、ブラウザのタイムゾーンでの YYYY-MM-DD にする。空・不正な値は null。 */
function localDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BOOK_COLUMNS: [header: string, value: (book: Book) => Cell][] = [
  ['タイトル', (b) => b.title],
  ['著者', (b) => b.authors.join('、') || null],
  ['ISBN', (b) => b.isbn],
  ['総ページ数', (b) => b.pages],
  ['ジャンル', (b) => b.genre],
  ['シリーズ', (b) => b.series],
  ['巻数', (b) => b.volume],
  ['タグ', (b) => b.tags.join('、') || null],
  ['状態', (b) => STATUS_LABELS[b.status]],
  ['現在のページ', (b) => b.current_page],
  ['評価', (b) => (b.rating > 0 ? b.rating : null)],
  ['お気に入り', (b) => (b.favorite ? '★' : null)],
  ['登録日', (b) => localDate(b.added_at)],
  ['読了日', (b) => localDate(b.finished_at)],
  ['感想', (b) => b.review],
]

/** 本の一覧をCSVにする（1行目は日本語の見出し）。 */
export function booksToCsv(books: Book[]): string {
  return toCsv([BOOK_COLUMNS.map(([header]) => header), ...books.map((b) => BOOK_COLUMNS.map(([, value]) => value(b)))])
}
