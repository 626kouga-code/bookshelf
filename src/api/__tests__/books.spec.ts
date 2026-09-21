import { afterEach, describe, expect, it, vi } from 'vitest'
import { listBooks } from '../books'

function stubFetch() {
  const fn = vi.fn<typeof fetch>(async () => Response.json([]))
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('listBooks', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('条件なしならクエリを付けない', async () => {
    const fetchMock = stubFetch()
    await listBooks()
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/books')
  })

  it('指定した条件をクエリにする（undefined・空文字は除く）', async () => {
    const fetchMock = stubFetch()
    await listBooks({ status: 'done', q: '猫 & 犬', genre: '', rating: 0, author: undefined, sort: 'title', order: 'asc' })
    const url = new URL(String(fetchMock.mock.calls[0]![0]), 'http://localhost')
    expect(url.pathname).toBe('/api/books')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: 'done',
      q: '猫 & 犬',
      rating: '0',
      sort: 'title',
      order: 'asc',
    })
  })
})
