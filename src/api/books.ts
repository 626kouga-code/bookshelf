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
