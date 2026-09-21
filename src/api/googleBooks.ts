import type { BookInput } from './books'

const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes'
const MAX_RESULTS = 10

/** 候補として表示・選択する書誌情報。フォームの入力項目に対応する。 */
export type BookCandidate = Required<Pick<BookInput, 'title'>> &
  Pick<BookInput, 'authors' | 'isbn' | 'pages' | 'genre' | 'cover'>

interface GoogleVolume {
  volumeInfo?: {
    title?: unknown
    authors?: unknown
    pageCount?: unknown
    categories?: unknown
    industryIdentifiers?: { type?: unknown; identifier?: unknown }[]
    imageLinks?: { thumbnail?: unknown; smallThumbnail?: unknown }
  }
}

/** 検索語がISBN（10桁/13桁、ハイフン・空白可）ならハイフンなしの数字列を返す。 */
export function asIsbn(input: string): string | null {
  const s = input.replace(/[-\s]/g, '').toUpperCase()
  return /^(\d{13}|\d{9}[\dX])$/.test(s) ? s : null
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** Google Books の1件分を候補に変換する。タイトルがないものは null。 */
function toCandidate(volume: GoogleVolume | null): BookCandidate | null {
  const info = volume?.volumeInfo
  if (!info || !isString(info.title)) return null

  const candidate: BookCandidate = { title: info.title.trim() }

  if (Array.isArray(info.authors)) {
    const authors = info.authors.filter(isString).map((a) => a.trim())
    if (authors.length) candidate.authors = authors
  }

  // ISBN-13 を優先し、なければ ISBN-10（サーバー側で13桁に正規化される）
  const ids = (info.industryIdentifiers ?? []).filter((i) => isString(i.identifier))
  const isbn = ids.find((i) => i.type === 'ISBN_13') ?? ids.find((i) => i.type === 'ISBN_10')
  if (isbn) candidate.isbn = String(isbn.identifier)

  if (typeof info.pageCount === 'number' && Number.isInteger(info.pageCount) && info.pageCount > 0) {
    candidate.pages = info.pageCount
  }

  if (Array.isArray(info.categories) && isString(info.categories[0])) {
    candidate.genre = info.categories[0].trim()
  }

  // 表紙URLは http で返ってくることがあるため https に揃える（混在コンテンツ対策）
  const cover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
  if (isString(cover)) candidate.cover = cover.replace(/^http:\/\//, 'https://')

  return candidate
}

/** Google Books のレスポンスから候補の一覧を取り出す。 */
export function parseCandidates(body: unknown): BookCandidate[] {
  const items = (body as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) return []
  return items.map((v) => toCandidate(v as GoogleVolume | null)).filter((c): c is BookCandidate => c !== null)
}

export class GoogleBooksError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleBooksError'
  }
}

/**
 * ISBN またはキーワードで Google Books を検索する。
 * APIキー（`VITE_GOOGLE_BOOKS_API_KEY`）があれば付ける。無くても動くが、共有クォータのため 429 になることがある。
 */
export async function searchGoogleBooks(query: string): Promise<BookCandidate[]> {
  const text = query.trim()
  if (text === '') return []

  const params = new URLSearchParams({
    q: asIsbn(text) ? `isbn:${asIsbn(text)}` : text,
    maxResults: String(MAX_RESULTS),
  })
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
  if (apiKey) params.set('key', apiKey)

  let res: Response
  try {
    res = await fetch(`${ENDPOINT}?${params}`)
  } catch {
    throw new GoogleBooksError('書誌情報を取得できませんでした。通信状況を確認してください。')
  }

  if (res.status === 429) {
    throw new GoogleBooksError('Google Books の利用上限に達しています。時間をおくか、手入力してください。')
  }
  if (!res.ok) {
    throw new GoogleBooksError(`書誌情報を取得できませんでした（${res.status}）。`)
  }

  try {
    return parseCandidates(await res.json())
  } catch {
    throw new GoogleBooksError('書誌情報の形式が正しくありません。')
  }
}
