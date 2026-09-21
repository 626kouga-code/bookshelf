import { request } from './client'

export type BookStatus = 'want' | 'reading' | 'done'
export type BookSort = 'added_at' | 'title' | 'rating' | 'finished_at'
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
}

export interface BookListParams {
  status?: BookStatus
  genre?: string
  rating?: number
  author?: string
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
