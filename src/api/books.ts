import { request } from './client'

export type BookStatus = 'want' | 'reading' | 'done'
export type BookSort = 'added_at' | 'title' | 'rating' | 'finished_at' | 'series'
export type SortOrder = 'asc' | 'desc'

export interface Book {
  id: number
  title: string
  authors: string[]
  isbn: string | null
  pages: number | null
  cover: string | null
  genre: string | null
  status: BookStatus
  current_page: number | null
  rating: number
  review: string | null
  added_at: string
  finished_at: string | null
  favorite: boolean
  tags: string[]
  series: string | null
  volume: number | null
}

/**
 * 本の登録・更新に送る項目。登録では title 以外は省略できる。
 * 更新では、省略した項目は変更されず、null を送ると値が消える。
 */
export interface BookInput {
  title: string
  authors?: string[] | null
  isbn?: string | null
  pages?: number | null
  cover?: string | null
  genre?: string | null
  status?: BookStatus
  current_page?: number | null
  rating?: number
  review?: string | null
  favorite?: boolean
  tags?: string[] | null
  series?: string | null
  volume?: number | null
}

export interface BookListParams {
  status?: BookStatus
  genre?: string
  rating?: number
  author?: string
  tag?: string
  series?: string
  favorite?: boolean
  q?: string
  sort?: BookSort
  order?: SortOrder
}

/** 本の一覧を取得する。未指定（undefined・空文字）の条件はクエリに含めない。 */
export function listBooks(params: BookListParams = {}): Promise<Book[]> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const qs = query.toString()
  return request<Book[]>(qs ? `/api/books?${qs}` : '/api/books')
}

/** 本を登録する。同じISBNが既にあれば 409 の ApiRequestError になる。 */
export function createBook(input: BookInput): Promise<Book> {
  return request<Book>('/api/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function getBook(id: number): Promise<Book> {
  return request<Book>(`/api/books/${id}`)
}

/** 本を更新する。送った項目だけが更新される（部分更新）。 */
export function updateBook(id: number, input: Partial<BookInput>): Promise<Book> {
  return request<Book>(`/api/books/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteBook(id: number): Promise<void> {
  return request<void>(`/api/books/${id}`, { method: 'DELETE' })
}

export interface ReadingLog {
  id: number
  book_id: number
  date: string
  pages: number
}

export interface ReadingLogInput {
  date: string
  pages: number
}

export interface Prediction {
  available: boolean
  reason?: string
  remainingPages?: number
  pagesPerDay?: number
  estimatedDays?: number
}

/** 対象の本の読書ログを、日付の新しい順で取得する。 */
export function listLogs(bookId: number): Promise<ReadingLog[]> {
  return request<ReadingLog[]>(`/api/books/${bookId}/logs`)
}

/** 読書ログを追加する。本の current_page もサーバー側で連動して更新される。 */
export function addLog(bookId: number, input: ReadingLogInput): Promise<ReadingLog> {
  return request<ReadingLog>(`/api/books/${bookId}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** 読書ログを削除する。本の current_page もサーバー側で連動して更新される。 */
export function deleteLog(bookId: number, logId: number): Promise<void> {
  return request<void>(`/api/books/${bookId}/logs/${logId}`, { method: 'DELETE' })
}

/** 直近の読書ペースからの読了予測を取得する。 */
export function getPrediction(bookId: number): Promise<Prediction> {
  return request<Prediction>(`/api/books/${bookId}/prediction`)
}

export interface Quote {
  id: number
  book_id: number
  text: string
  page: number | null
}

export interface QuoteInput {
  text: string
  page?: number | null
}

/** 横断検索の結果。本のタイトルが付く。 */
export interface QuoteSearchResult extends Quote {
  book_title: string
}

/** 対象の本の引用を、新しい順で取得する。 */
export function listQuotes(bookId: number): Promise<Quote[]> {
  return request<Quote[]>(`/api/books/${bookId}/quotes`)
}

export function addQuote(bookId: number, input: QuoteInput): Promise<Quote> {
  return request<Quote>(`/api/books/${bookId}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteQuote(bookId: number, quoteId: number): Promise<void> {
  return request<void>(`/api/books/${bookId}/quotes/${quoteId}`, { method: 'DELETE' })
}

/** 全本の引用をキーワードで横断検索する。空文字は「指定なし」として扱う。 */
export function searchQuotes(q: string): Promise<QuoteSearchResult[]> {
  const query = new URLSearchParams()
  if (q.trim() !== '') query.set('q', q.trim())
  const qs = query.toString()
  return request<QuoteSearchResult[]>(qs ? `/api/quotes?${qs}` : '/api/quotes')
}
