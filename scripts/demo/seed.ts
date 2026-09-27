/**
 * デモ用のサンプルデータ（バックアップJSONの形式）を作り、バックエンドにインポートする。
 * 表紙・ISBN・ページ数は Google Books から取得する（APIキーは .env.local の VITE_GOOGLE_BOOKS_API_KEY）。
 *
 * 単体でも実行できる（バックエンドが 8080 で動いていること。データはすべて置き換わる）:
 *   node scripts/demo/seed.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

type Status = 'want' | 'reading' | 'done'

interface DemoBook {
  query: { title: string; author: string }
  /** Google Books の検索語（タイトル・著者の検索で表紙が見つからない本だけ指定する） */
  search?: string
  genre: string
  status: Status
  /** 登録したのが何日前か */
  addedDaysAgo: number
  /** 読了したのが何日前か（done のとき） */
  finishedDaysAgo?: number
  rating?: number
  review?: string
  favorite?: boolean
  tags?: string[]
  series?: string
  volume?: number
  /** 読書中のときの読んだ割合（0〜1） */
  progress?: number
}

const DEMO_BOOKS: DemoBook[] = [
  { query: { title: '三体', author: '劉慈欣' }, genre: 'SF', status: 'done', addedDaysAgo: 200, finishedDaysAgo: 170, rating: 5, favorite: true, tags: ['SF', '名作'], series: '三体', volume: 1, review: '序盤は静かだが、中盤から一気にスケールが広がる。' },
  { query: { title: '三体Ⅱ 黒暗森林 上', author: '劉慈欣' }, search: 'intitle:黒暗森林 inauthor:劉慈欣', genre: 'SF', status: 'reading', addedDaysAgo: 60, tags: ['SF'], series: '三体', volume: 2, progress: 0.6 },
  { query: { title: '三体Ⅲ 死神永生 上', author: '劉慈欣' }, genre: 'SF', status: 'want', addedDaysAgo: 12, tags: ['SF'], series: '三体', volume: 3 },
  { query: { title: 'リーダブルコード', author: 'Dustin Boswell' }, search: 'intitle:リーダブルコード', genre: '技術書', status: 'reading', addedDaysAgo: 30, tags: ['技術書', 'プログラミング'], progress: 0.35 },
  { query: { title: 'コンビニ人間', author: '村田沙耶香' }, genre: '小説', status: 'done', addedDaysAgo: 150, finishedDaysAgo: 140, rating: 4, tags: ['小説'] },
  { query: { title: 'サピエンス全史 上', author: 'ユヴァル・ノア・ハラリ' }, genre: '歴史', status: 'done', addedDaysAgo: 120, finishedDaysAgo: 80, rating: 5, favorite: true, tags: ['名作'] },
  { query: { title: 'FACTFULNESS', author: 'ハンス・ロスリング' }, genre: 'ビジネス', status: 'done', addedDaysAgo: 100, finishedDaysAgo: 45, rating: 4, tags: ['ビジネス'] },
  { query: { title: '嫌われる勇気', author: '岸見一郎' }, genre: '自己啓発', status: 'want', addedDaysAgo: 40 },
  { query: { title: '君たちはどう生きるか', author: '吉野源三郎' }, genre: '小説', status: 'want', addedDaysAgo: 5, tags: ['名作'] },
]

const QUOTES: { bookIndex: number; text: string; page: number }[] = [
  { bookIndex: 0, text: '弱さと無知は生存の障害ではない。傲慢こそが障害なのだ。', page: 283 },
  { bookIndex: 3, text: 'コードは他の人が最短時間で理解できるように書かなければいけない。', page: 3 },
  { bookIndex: 5, text: '虚構のおかげで、私たちは単に物事を想像するだけでなく、集団でそうできるようになった。', page: 41 },
]

function readApiKey(): string {
  const envLocal = fileURLToPath(new URL('../../.env.local', import.meta.url))
  if (!existsSync(envLocal)) return ''
  const line = readFileSync(envLocal, 'utf8')
    .split(/\r?\n/)
    .find((l) => /^\s*VITE_GOOGLE_BOOKS_API_KEY\s*=/.test(l))
  return line ? line.replace(/^\s*VITE_GOOGLE_BOOKS_API_KEY\s*=\s*/, '').trim().replace(/^["']|["']$/g, '') : ''
}

interface Volume {
  isbn: string | null
  pages: number | null
  cover: string | null
}

/** Google Books を検索し、表紙のある最初の結果の ISBN・ページ数・表紙を返す。見つからなければ空 */
async function lookup(q: string, apiKey: string): Promise<Volume> {
  const params = new URLSearchParams({ q, maxResults: '10', printType: 'books' })
  if (apiKey) params.set('key', apiKey)
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
    if (!res.ok) {
      console.warn(`Google Books の検索に失敗しました（${res.status}）: ${q}`)
      return { isbn: null, pages: null, cover: null }
    }
    const data = (await res.json()) as {
      items?: {
        volumeInfo: {
          industryIdentifiers?: { type: string; identifier: string }[]
          pageCount?: number
          imageLinks?: { thumbnail?: string }
        }
      }[]
    }
    // 表紙のある結果を優先する
    const items = data.items ?? []
    const info = (items.find((i) => i.volumeInfo.imageLinks?.thumbnail) ?? items[0])?.volumeInfo
    if (!info) return { isbn: null, pages: null, cover: null }
    const isbn = info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ?? null
    const cover = info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ?? null
    return { isbn, pages: info.pageCount ?? null, cover }
  } catch (e) {
    console.warn(`Google Books の検索に失敗しました（${e instanceof Error ? e.message : e}）: ${q}`)
    return { isbn: null, pages: null, cover: null }
  }
}

/**
 * 表紙つきの結果を探す。Google Books の検索結果は毎回少しずつ変わるので、
 * 表紙が無ければ見つかった ISBN で探し直し、それでも無ければ間を置いて最大3回まで試す
 */
async function lookupWithCover(q: string, apiKey: string): Promise<Volume> {
  let best: Volume = { isbn: null, pages: null, cover: null }
  for (let attempt = 0; attempt < 3; attempt++) {
    const v = await lookup(q, apiKey)
    if (!v.cover && v.isbn) {
      const byIsbn = await lookup(`isbn:${v.isbn}`, apiKey)
      v.cover = byIsbn.cover
      v.pages ??= byIsbn.pages
    }
    if (v.cover) return v
    if (!best.isbn) best = v
    await new Promise((r) => setTimeout(r, 1000))
  }
  return best
}

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(20, 0, 0, 0)
  return d
}
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** デモ用のバックアップJSONを作る（読書ログは毎回同じになるよう、固定の疑似乱数で作る） */
export async function buildDemoBackup() {
  const apiKey = readApiKey()
  // 1冊ずつ順に問い合わせる（一度に送ると利用上限にかかりやすいため）
  const volumes: Volume[] = []
  for (const b of DEMO_BOOKS) {
    volumes.push(await lookupWithCover(b.search ?? `intitle:${b.query.title} inauthor:${b.query.author}`, apiKey))
  }
  const usedIsbns = new Set<string>()

  const books = DEMO_BOOKS.map((b, i) => {
    const v = volumes[i]!
    const isbn = v.isbn && !usedIsbns.has(v.isbn) ? v.isbn : null
    if (isbn) usedIsbns.add(isbn)
    const pages = v.pages ?? 300
    return {
      id: i + 1,
      title: b.query.title,
      authors: [b.query.author],
      isbn,
      pages,
      cover: v.cover,
      genre: b.genre,
      status: b.status,
      current_page: b.status === 'reading' ? Math.round(pages * (b.progress ?? 0)) : b.status === 'done' ? pages : null,
      rating: b.rating ?? 0,
      review: b.review ?? null,
      added_at: daysAgo(b.addedDaysAgo).toISOString(),
      finished_at: b.status === 'done' ? daysAgo(b.finishedDaysAgo ?? 0).toISOString() : null,
      favorite: b.favorite ?? false,
      tags: b.tags ?? [],
      series: b.series ?? null,
      volume: b.volume ?? null,
    }
  })

  // 最近ほど読む日が多く、直近の数日は毎日読んでいる読書ログ
  let seed = 20260928
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  const readingIds = books.filter((b) => b.status === 'reading').map((b) => b.id)
  const reading_logs: { id: number; book_id: number; date: string; pages: number }[] = []
  for (let day = 1; day < 360; day++) {
    const chance = day < 8 ? 1 : day < 60 ? 0.65 : day < 200 ? 0.4 : 0.15
    if (rand() > chance) continue
    reading_logs.push({
      id: reading_logs.length + 1,
      book_id: readingIds[Math.floor(rand() * readingIds.length)]!,
      date: ymd(daysAgo(day)),
      pages: 8 + Math.floor(rand() * 45),
    })
  }

  const quotes = QUOTES.map((q, i) => ({ id: i + 1, book_id: q.bookIndex + 1, text: q.text, page: q.page }))

  const now = new Date()
  const year = String(now.getFullYear())
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const goals = [
    { id: 1, period_type: 'year', period: year, target_books: 24, target_daily_pages: null },
    { id: 2, period_type: 'month', period: month, target_books: 3, target_daily_pages: 30 },
  ]

  return { version: 1, exported_at: now.toISOString(), books, reading_logs, quotes, goals }
}

/** バックエンドにデモデータをインポートする（既存のデータはすべて置き換わる） */
export async function seedDemo(apiBase = 'http://127.0.0.1:8080') {
  const backup = await buildDemoBackup()
  const res = await fetch(`${apiBase}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backup),
  })
  if (!res.ok) throw new Error(`インポートに失敗しました: ${res.status} ${await res.text()}`)
  const covers = backup.books.filter((b) => b.cover).length
  return { ...(await res.json()), covers }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedDemo().then((r) => console.log('デモデータを入れました:', r))
}
