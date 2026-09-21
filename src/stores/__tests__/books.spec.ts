import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Book } from '@/api/books'
import { ApiRequestError } from '@/api/client'
import { useBooksStore } from '../books'

vi.mock('@/api/books', () => ({ listBooks: vi.fn() }))
const { listBooks } = await import('@/api/books')
const listBooksMock = vi.mocked(listBooks)

function makeBook(id: number, title: string): Book {
  return {
    id,
    title,
    authors: [],
    isbn: null,
    pages: null,
    cover: null,
    genre: null,
    status: 'want',
    current_page: null,
    rating: 0,
    review: null,
    added_at: '2026-01-01T00:00:00.000Z',
    finished_at: null,
  }
}

describe('books store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listBooksMock.mockReset()
  })

  it('既定の条件で取得し、結果を保持する', async () => {
    listBooksMock.mockResolvedValue([makeBook(1, 'a')])
    const store = useBooksStore()
    await store.fetchBooks()
    expect(listBooksMock).toHaveBeenCalledWith({
      status: undefined,
      q: undefined,
      sort: 'added_at',
      order: 'desc',
    })
    expect(store.books.map((b) => b.title)).toEqual(['a'])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('絞り込み条件をAPIに渡す（検索語は前後の空白を除く）', async () => {
    listBooksMock.mockResolvedValue([])
    const store = useBooksStore()
    store.filters.status = 'done'
    store.filters.q = '  猫 '
    store.filters.sort = 'title'
    store.filters.order = 'asc'
    await store.fetchBooks()
    expect(listBooksMock).toHaveBeenCalledWith({ status: 'done', q: '猫', sort: 'title', order: 'asc' })
  })

  it('失敗したらエラーメッセージを保持し、成功すると消える', async () => {
    const store = useBooksStore()
    listBooksMock.mockRejectedValueOnce(new ApiRequestError(0, 'サーバーに接続できません'))
    await store.fetchBooks()
    expect(store.error).toBe('サーバーに接続できません')
    expect(store.loading).toBe(false)

    listBooksMock.mockResolvedValueOnce([])
    await store.fetchBooks()
    expect(store.error).toBeNull()
  })

  it('連続して呼んだとき、古いリクエストの結果は捨てる', async () => {
    let resolveFirst!: (books: Book[]) => void
    listBooksMock.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    listBooksMock.mockResolvedValueOnce([makeBook(2, 'new')])

    const store = useBooksStore()
    const first = store.fetchBooks()
    await store.fetchBooks()
    resolveFirst([makeBook(1, 'old')])
    await first

    expect(store.books.map((b) => b.title)).toEqual(['new'])
    expect(store.loading).toBe(false)
  })

  it('isFiltered は状態か検索語が指定されているときだけ true', () => {
    const store = useBooksStore()
    expect(store.isFiltered).toBe(false)
    store.filters.q = '  '
    expect(store.isFiltered).toBe(false)
    store.filters.q = '猫'
    expect(store.isFiltered).toBe(true)
    store.filters.q = ''
    store.filters.status = 'reading'
    expect(store.isFiltered).toBe(true)
  })
})
