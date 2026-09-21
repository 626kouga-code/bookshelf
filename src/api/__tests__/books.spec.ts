import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBook, listBooks } from '../books'

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

describe('createBook', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POST /api/books にJSONで送り、登録された本を返す', async () => {
    const created = { id: 1, title: 'a' }
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(created, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createBook({ title: 'a', authors: ['x'], status: 'reading' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/books')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual({ title: 'a', authors: ['x'], status: 'reading' })
    expect(result).toEqual(created)
  })

  it('ISBN重複（409）はサーバーのメッセージを持つ例外になる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: '同じISBNの本が既に登録されています' }, { status: 409 })),
    )
    await expect(createBook({ title: 'a', isbn: '9780306406157' })).rejects.toMatchObject({
      status: 409,
      message: '同じISBNの本が既に登録されています',
    })
  })
})
