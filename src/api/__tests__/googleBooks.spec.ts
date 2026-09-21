import { afterEach, describe, expect, it, vi } from 'vitest'
import { asIsbn, GoogleBooksError, parseCandidates, searchGoogleBooks } from '../googleBooks'

// Google Books API（volumes.list）のレスポンスの形に沿ったサンプル
const sample = {
  kind: 'books#volumes',
  totalItems: 3,
  items: [
    {
      volumeInfo: {
        title: 'リーダブルコード',
        authors: ['Dustin Boswell', 'Trevor Foucher'],
        industryIdentifiers: [
          { type: 'ISBN_10', identifier: '4873115655' },
          { type: 'ISBN_13', identifier: '9784873115658' },
        ],
        pageCount: 260,
        categories: ['Computers', 'Programming'],
        imageLinks: {
          smallThumbnail: 'http://books.google.com/small.jpg',
          thumbnail: 'http://books.google.com/thumb.jpg',
        },
      },
    },
    { volumeInfo: { title: '最小の本' } },
    { volumeInfo: { authors: ['タイトルなし'] } },
  ],
}

function stubFetch(response: Response | Error) {
  const fn = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const requestedUrl = (fn: ReturnType<typeof stubFetch>) => new URL(String(fn.mock.calls[0]![0]))

describe('asIsbn', () => {
  it.each([
    ['9784873115658', '9784873115658'],
    ['978-4-87311-565-8', '9784873115658'],
    [' 4873115655 ', '4873115655'],
    ['080442957x', '080442957X'],
  ])('%s はISBNとして扱う', (input, expected) => {
    expect(asIsbn(input)).toBe(expected)
  })

  it.each([['リーダブルコード'], ['123'], ['97848731156'], ['abcdefghij'], ['']])(
    '%s はISBNではない',
    (input) => {
      expect(asIsbn(input)).toBeNull()
    },
  )
})

describe('parseCandidates', () => {
  it('書誌情報をフォームの項目に変換する', () => {
    expect(parseCandidates(sample)[0]).toEqual({
      title: 'リーダブルコード',
      authors: ['Dustin Boswell', 'Trevor Foucher'],
      isbn: '9784873115658',
      pages: 260,
      genre: 'Computers',
      cover: 'https://books.google.com/thumb.jpg',
    })
  })

  it('タイトルだけの本は他の項目を持たない', () => {
    expect(parseCandidates(sample)[1]).toEqual({ title: '最小の本' })
  })

  it('タイトルがない本は除く', () => {
    expect(parseCandidates(sample).map((c) => c.title)).toEqual(['リーダブルコード', '最小の本'])
  })

  it('ISBN-13 がなければ ISBN-10 を使う', () => {
    const body = {
      items: [{ volumeInfo: { title: 'a', industryIdentifiers: [{ type: 'ISBN_10', identifier: '4873115655' }] } }],
    }
    expect(parseCandidates(body)[0]!.isbn).toBe('4873115655')
  })

  it('ISBN以外の識別子（OTHER）は使わない', () => {
    const body = { items: [{ volumeInfo: { title: 'a', industryIdentifiers: [{ type: 'OTHER', identifier: 'PKEY:1' }] } }] }
    expect(parseCandidates(body)[0]!.isbn).toBeUndefined()
  })

  it('thumbnail がなければ smallThumbnail を使う', () => {
    const body = { items: [{ volumeInfo: { title: 'a', imageLinks: { smallThumbnail: 'http://x/s.jpg' } } }] }
    expect(parseCandidates(body)[0]!.cover).toBe('https://x/s.jpg')
  })

  it('ページ数が不正（0・小数・文字列）なら無視する', () => {
    for (const pageCount of [0, 1.5, '260', -1]) {
      expect(parseCandidates({ items: [{ volumeInfo: { title: 'a', pageCount } }] })[0]!.pages).toBeUndefined()
    }
  })

  it('items がない・想定外の形なら空配列', () => {
    expect(parseCandidates({ totalItems: 0 })).toEqual([])
    expect(parseCandidates(null)).toEqual([])
    expect(parseCandidates({ items: 'x' })).toEqual([])
    expect(parseCandidates({ items: [null, 1] })).toEqual([])
  })
})

describe('searchGoogleBooks', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ISBNなら isbn: 検索にする', async () => {
    const fetchMock = stubFetch(Response.json(sample))
    const result = await searchGoogleBooks('978-4-87311-565-8')
    const url = requestedUrl(fetchMock)
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/books/v1/volumes')
    expect(url.searchParams.get('q')).toBe('isbn:9784873115658')
    expect(url.searchParams.get('maxResults')).toBe('10')
    expect(result).toHaveLength(2)
  })

  it('タイトルならそのままキーワード検索にする', async () => {
    const fetchMock = stubFetch(Response.json({ totalItems: 0 }))
    expect(await searchGoogleBooks('  吾輩は猫である ')).toEqual([])
    expect(requestedUrl(fetchMock).searchParams.get('q')).toBe('吾輩は猫である')
  })

  it('空の検索語は通信せずに空配列を返す', async () => {
    const fetchMock = stubFetch(Response.json(sample))
    expect(await searchGoogleBooks('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('APIキーが設定されていれば付ける', async () => {
    vi.stubEnv('VITE_GOOGLE_BOOKS_API_KEY', 'test-key')
    const fetchMock = stubFetch(Response.json({ totalItems: 0 }))
    await searchGoogleBooks('猫')
    expect(requestedUrl(fetchMock).searchParams.get('key')).toBe('test-key')
    vi.unstubAllEnvs()
  })

  it('APIキーが無ければ key を付けない', async () => {
    vi.stubEnv('VITE_GOOGLE_BOOKS_API_KEY', '')
    const fetchMock = stubFetch(Response.json({ totalItems: 0 }))
    await searchGoogleBooks('猫')
    expect(requestedUrl(fetchMock).searchParams.has('key')).toBe(false)
    vi.unstubAllEnvs()
  })

  it('429 は利用上限のメッセージにする', async () => {
    stubFetch(Response.json({ error: { code: 429 } }, { status: 429 }))
    const error = await searchGoogleBooks('猫').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GoogleBooksError)
    expect((error as Error).message).toContain('利用上限')
  })

  it('その他のHTTPエラーはステータスを含むメッセージにする', async () => {
    stubFetch(new Response('boom', { status: 503 }))
    await expect(searchGoogleBooks('猫')).rejects.toThrow('503')
  })

  it('通信に失敗したら通信状況のメッセージにする', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    await expect(searchGoogleBooks('猫')).rejects.toThrow('通信状況')
  })

  it('JSONでない応答は形式エラーにする', async () => {
    stubFetch(new Response('<html>', { status: 200 }))
    await expect(searchGoogleBooks('猫')).rejects.toThrow('形式')
  })
})
