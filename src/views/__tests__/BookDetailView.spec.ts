import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Book, Quote, ReadingLog } from '@/api/books'
import BookForm from '@/components/BookForm.vue'
import BookDetailView from '../BookDetailView.vue'

const baseBook: Book = {
  id: 7,
  title: '吾輩は猫である',
  authors: ['夏目漱石'],
  isbn: '9784873115658',
  pages: 200,
  cover: null,
  genre: '小説',
  status: 'reading',
  current_page: 50,
  rating: 4,
  review: '面白かった\n二行目',
  added_at: '2026-01-02T12:00:00.000Z',
  finished_at: null,
}

/**
 * 本を1冊だけ持つ簡易サーバー。PUT は送られた項目でマージして返す。
 * 読書ログの追加・削除は本物のAPIと同様に current_page と連動する。
 */
function stubServer(
  initial: Book | null = baseBook,
  initialLogs: ReadingLog[] = [],
  initialQuotes: Quote[] = [],
) {
  let stored = initial
  let logs = [...initialLogs]
  let nextLogId = Math.max(0, ...logs.map((l) => l.id)) + 1
  let quotes = [...initialQuotes]
  let nextQuoteId = Math.max(0, ...quotes.map((q) => q.id)) + 1
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    if (!path.startsWith('/api/books/')) return Response.json({ error: 'unexpected' }, { status: 500 })
    if (!stored) return Response.json({ error: '本が見つかりません' }, { status: 404 })

    if (path.endsWith('/prediction')) {
      return Response.json({ available: false, reason: '直近の読書ログがありません' })
    }
    if (path.includes('/logs')) {
      if (method === 'GET') return Response.json(logs)
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { date: string; pages: number }
        const created: ReadingLog = { id: nextLogId++, book_id: stored.id, date: body.date, pages: body.pages }
        logs = [created, ...logs]
        const cap = stored.pages ?? Infinity
        stored = { ...stored, current_page: Math.min((stored.current_page ?? 0) + body.pages, cap) }
        return Response.json(created, { status: 201 })
      }
      if (method === 'DELETE') {
        const id = Number(path.split('/').pop())
        const target = logs.find((l) => l.id === id)
        logs = logs.filter((l) => l.id !== id)
        if (target) stored = { ...stored, current_page: Math.max((stored.current_page ?? 0) - target.pages, 0) }
        return new Response(null, { status: 204 })
      }
    }
    if (path.includes('/quotes')) {
      if (method === 'GET') return Response.json(quotes)
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { text: string; page?: number | null }
        const created: Quote = { id: nextQuoteId++, book_id: stored.id, text: body.text, page: body.page ?? null }
        quotes = [created, ...quotes]
        return Response.json(created, { status: 201 })
      }
      if (method === 'DELETE') {
        const id = Number(path.split('/').pop())
        quotes = quotes.filter((q) => q.id !== id)
        return new Response(null, { status: 204 })
      }
    }

    if (method === 'GET') return Response.json(stored)
    if (method === 'PUT') {
      stored = { ...stored, ...JSON.parse(String(init?.body)) }
      return Response.json(stored)
    }
    if (method === 'DELETE') {
      stored = null
      return new Response(null, { status: 204 })
    }
    return Response.json({ error: 'unexpected' }, { status: 500 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const callsOf = (fn: ReturnType<typeof stubServer>, method: string) =>
  fn.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method)

/**
 * 読書ログ・引用・読了予測への取得に、テスト対象外なら既定の空応答を返す（対象なら null）。
 * これらのエンドポイントを気にしない簡易モックで使う。
 */
function defaultSubResource(path: string): Response | null {
  if (path.endsWith('/prediction')) return Response.json({ available: false, reason: '直近の読書ログがありません' })
  if (path.includes('/logs') || path.includes('/quotes')) return Response.json([])
  return null
}

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>shelf</div>' } },
      { path: '/books/:id', component: BookDetailView },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(BookDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

const button = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper'], text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)!

describe('BookDetailView', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('表示', () => {
    it('本の情報を表示する', async () => {
      stubServer()
      const { wrapper } = await mountAt('/books/7')
      const text = wrapper.text()
      expect(text).toContain('吾輩は猫である')
      expect(text).toContain('夏目漱石')
      expect(text).toContain('読書中')
      expect(text).toContain('小説')
      expect(text).toContain('9784873115658')
      expect(text).toContain('200')
      expect(text).toContain('50 / 200 ページ（25%）')
      expect(text).toContain('2026/1/2')
      expect(wrapper.find('[role="radio"][aria-checked="true"]').attributes('aria-label')).toBe('4つ星')
      // 感想は入力欄に入る（改行を保つ）
      expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('面白かった\n二行目')
    })

    it('未入力の項目は表示しない', async () => {
      stubServer({ ...baseBook, authors: [], isbn: null, pages: null, genre: null, review: null, rating: 0, current_page: null })
      const { wrapper } = await mountAt('/books/7')
      const text = wrapper.text()
      for (const label of ['ISBN', '総ページ数', 'ジャンル', '読了日']) expect(text).not.toContain(label)
      // 評価・感想は未入力でも入力欄を表示する
      expect(wrapper.find('[role="radio"][aria-checked="true"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('未評価')
      expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    })

    it('読了した本は読了日を表示し、進捗バーは出さない', async () => {
      stubServer({ ...baseBook, status: 'done', finished_at: '2026-03-04T12:00:00.000Z' })
      const { wrapper } = await mountAt('/books/7')
      expect(wrapper.text()).toContain('読了日')
      expect(wrapper.text()).toContain('2026/3/4')
      expect(wrapper.text()).not.toContain('ページ（')
    })

    it('表紙があれば画像を表示する', async () => {
      stubServer({ ...baseBook, cover: 'https://example.com/c.jpg' })
      const { wrapper } = await mountAt('/books/7')
      expect(wrapper.find('img').attributes('src')).toBe('https://example.com/c.jpg')
    })

    it('本棚に戻るリンクがある', async () => {
      stubServer()
      const { wrapper } = await mountAt('/books/7')
      expect(wrapper.find('a[href="/"]').exists()).toBe(true)
    })
  })

  describe('取得の失敗', () => {
    it('存在しない本は「見つかりません」を表示し、再読み込みは出さない', async () => {
      stubServer(null)
      const { wrapper } = await mountAt('/books/999')
      expect(wrapper.find('[role="alert"]').text()).toContain('本が見つかりません')
      expect(wrapper.find('[role="alert"] button').exists()).toBe(false)
    })

    it('IDが数値でなければ通信せずに「見つかりません」を表示する', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/abc')
      expect(wrapper.find('[role="alert"]').text()).toContain('本が見つかりません')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('通信に失敗したらエラーを表示し、再読み込みで復旧できる', async () => {
      let fail = true
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          if (fail) throw new TypeError('Failed to fetch')
          return Response.json(baseBook)
        }),
      )
      const { wrapper } = await mountAt('/books/7')
      expect(wrapper.find('[role="alert"]').text()).toContain('サーバーに接続できません')

      fail = false
      await wrapper.find('[role="alert"] button').trigger('click')
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('吾輩は猫である')
    })
  })

  describe('編集', () => {
    it('「編集」で現在の内容が入ったフォームに切り替わる', async () => {
      stubServer()
      const { wrapper } = await mountAt('/books/7')
      await button(wrapper, '編集').trigger('click')

      expect(wrapper.find('h2').text()).toBe('本を編集')
      expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('吾輩は猫である')
      expect(button(wrapper, '保存する')).toBeDefined()
    })

    it('保存すると変更を送り、表示に戻って新しい内容を表示する', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/7')
      await button(wrapper, '編集').trigger('click')

      await wrapper.find('input[type="text"]').setValue('坊っちゃん')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      const [, init] = callsOf(fetchMock, 'PUT')[0]!
      expect(JSON.parse(String(init?.body))).toMatchObject({ title: '坊っちゃん', status: 'reading', current_page: 50 })
      expect(wrapper.findComponent(BookForm).exists()).toBe(false)
      expect(wrapper.find('h2').text()).toBe('坊っちゃん')
    })

    it('項目を空にして保存すると、その値が消える', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/7')
      await button(wrapper, '編集').trigger('click')

      const genre = wrapper.findAll('label').find((l) => l.text().startsWith('ジャンル'))!.find('input')
      await genre.setValue('')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(JSON.parse(String(callsOf(fetchMock, 'PUT')[0]![1]?.body))).toMatchObject({ genre: null })
      expect(wrapper.text()).not.toContain('ジャンル')
    })

    it('キャンセルすると保存せずに表示へ戻る', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/7')
      await button(wrapper, '編集').trigger('click')
      await wrapper.find('input[type="text"]').setValue('変更途中')

      await button(wrapper, 'キャンセル').trigger('click')

      expect(callsOf(fetchMock, 'PUT')).toHaveLength(0)
      expect(wrapper.findComponent(BookForm).exists()).toBe(false)
      expect(wrapper.find('h2').text()).toBe('吾輩は猫である')
    })

    it('キャンセル後にもう一度編集すると、変更途中の内容は残らない', async () => {
      stubServer()
      const { wrapper } = await mountAt('/books/7')
      await button(wrapper, '編集').trigger('click')
      await wrapper.find('input[type="text"]').setValue('変更途中')
      await button(wrapper, 'キャンセル').trigger('click')

      await button(wrapper, '編集').trigger('click')
      expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('吾輩は猫である')
    })

    it('保存に失敗したらエラーを表示して編集を続けられる（ISBN重複など）', async () => {
      const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        if (init?.method === 'PUT') return Response.json({ error: '同じISBNの本が既に登録されています' }, { status: 409 })
        return defaultSubResource(String(input)) ?? Response.json(baseBook)
      })
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper } = await mountAt('/books/7')
      await button(wrapper, '編集').trigger('click')
      await wrapper.find('input[type="text"]').setValue('編集中の題名')

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('[role="alert"]').text()).toContain('同じISBNの本が既に登録されています')
      expect(wrapper.findComponent(BookForm).exists()).toBe(true)
      expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('編集中の題名')
    })
  })

  describe('削除', () => {
    it('確認してから削除し、本棚へ戻る', async () => {
      const fetchMock = stubServer()
      const { wrapper, router } = await mountAt('/books/7')

      await button(wrapper, '削除').trigger('click')
      await flushPromises()

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('吾輩は猫である'))
      expect(callsOf(fetchMock, 'DELETE')).toHaveLength(1)
      expect(router.currentRoute.value.path).toBe('/')
    })

    it('確認でキャンセルしたら削除しない', async () => {
      vi.mocked(window.confirm).mockReturnValue(false)
      const fetchMock = stubServer()
      const { wrapper, router } = await mountAt('/books/7')

      await button(wrapper, '削除').trigger('click')
      await flushPromises()

      expect(callsOf(fetchMock, 'DELETE')).toHaveLength(0)
      expect(router.currentRoute.value.path).toBe('/books/7')
    })

    it('削除に失敗したらエラーを表示して画面に留まる', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: unknown, init?: RequestInit) => {
          if (init?.method === 'DELETE') return new Response('boom', { status: 500 })
          return defaultSubResource(String(input)) ?? Response.json(baseBook)
        }),
      )
      const { wrapper, router } = await mountAt('/books/7')

      await button(wrapper, '削除').trigger('click')
      await flushPromises()

      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
      expect(router.currentRoute.value.path).toBe('/books/7')
      expect(button(wrapper, '削除').attributes('disabled')).toBeUndefined()
    })
  })

  it('別の本のページに移動すると、その本を読み込み直す', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const path = String(input)
      const sub = defaultSubResource(path)
      if (sub) return sub
      const id = path.split('/').pop()
      return Response.json({ ...baseBook, id: Number(id), title: `本${id}` })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt('/books/1')
    expect(wrapper.find('h2').text()).toBe('本1')

    await router.push('/books/2')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('本2')
  })
})

describe('BookDetailView の進捗・評価・感想の更新', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  type Wrapper = Awaited<ReturnType<typeof mountAt>>['wrapper']

  const putBody = (fn: ReturnType<typeof stubServer>, index = 0) =>
    JSON.parse(String(callsOf(fn, 'PUT')[index]![1]?.body))
  const star = (wrapper: Wrapper, n: number) => wrapper.find(`[role="radio"][aria-label="${n}つ星"]`)
  const hasButton = (wrapper: Wrapper, text: string) => wrapper.findAll('button').some((b) => b.text() === text)
  const checkedStar = (wrapper: Wrapper) =>
    wrapper.find('[role="radio"][aria-checked="true"]').attributes('aria-label')

  describe('現在のページ', () => {
    it('読書中の本で現在のページを更新すると、その項目だけを送り、進捗表示も更新される', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/7')

      await wrapper.find('input[type="number"]').setValue('120')
      await wrapper.find('form[novalidate]').trigger('submit')
      await flushPromises()

      expect(putBody(fetchMock)).toEqual({ current_page: 120 })
      expect(wrapper.text()).toContain('120 / 200 ページ（60%）')
    })

    it('総ページ数を超える値は送らずにエラーを表示する', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/7')

      await wrapper.find('input[type="number"]').setValue('201')
      await wrapper.find('form[novalidate]').trigger('submit')
      await flushPromises()

      expect(callsOf(fetchMock, 'PUT')).toHaveLength(0)
      expect(wrapper.text()).toContain('総ページ数（200）を超えています')
    })

    it('読書中以外の本には現在のページの入力欄を出さない', async () => {
      stubServer({ ...baseBook, status: 'want', current_page: null })
      const { wrapper } = await mountAt('/books/7')
      expect(wrapper.find('[aria-label="進捗"] input[type="number"]').exists()).toBe(false)
    })
  })

  describe('状態の切り替え', () => {
    it('「読了にする」で状態だけを読了に更新し、読了日が表示される', async () => {
      const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        const path = String(input)
        if (init?.method === 'PUT') {
          return Response.json({ ...baseBook, status: 'done', finished_at: '2026-03-04T12:00:00.000Z' })
        }
        if (path.endsWith('/prediction')) return Response.json({ available: false, reason: '既に最後まで読んでいます' })
        if (path.includes('/logs') || path.includes('/quotes')) return Response.json([])
        return Response.json(baseBook)
      })
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper } = await mountAt('/books/7')

      await button(wrapper, '読了にする').trigger('click')
      await flushPromises()

      const [, init] = callsOf(fetchMock, 'PUT')[0]!
      expect(JSON.parse(String(init?.body))).toEqual({ status: 'done' })
      expect(wrapper.text()).toContain('読了日')
      expect(wrapper.text()).toContain('2026/3/4')
      expect(hasButton(wrapper, '読了にする')).toBe(false)
      expect(wrapper.find('[aria-label="進捗"] input[type="number"]').exists()).toBe(false)
    })

    it('読みたい本には「読み始める」を出し、押すと読書中になる', async () => {
      const fetchMock = stubServer({ ...baseBook, status: 'want', current_page: null })
      const { wrapper } = await mountAt('/books/7')
      expect(hasButton(wrapper, '読了にする')).toBe(false)

      await button(wrapper, '読み始める').trigger('click')
      await flushPromises()

      expect(putBody(fetchMock)).toEqual({ status: 'reading' })
      expect(wrapper.text()).toContain('読書中')
      expect(wrapper.find('input[type="number"]').exists()).toBe(true)
      expect(hasButton(wrapper, '読み始める')).toBe(false)
    })

    it('読了した本には状態の切り替えボタンを出さない', async () => {
      stubServer({ ...baseBook, status: 'done', finished_at: '2026-03-04T12:00:00.000Z' })
      const { wrapper } = await mountAt('/books/7')
      expect(hasButton(wrapper, '読了にする')).toBe(false)
      expect(hasButton(wrapper, '読み始める')).toBe(false)
    })
  })

  describe('星評価', () => {
    it('星を押すと評価だけを更新する', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/7')

      await star(wrapper, 5).trigger('click')
      await flushPromises()

      expect(putBody(fetchMock)).toEqual({ rating: 5 })
      expect(checkedStar(wrapper)).toBe('5つ星')
    })

    it('今の評価と同じ星を押すと未評価に戻す', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/7')

      await star(wrapper, 4).trigger('click')
      await flushPromises()

      expect(putBody(fetchMock)).toEqual({ rating: 0 })
      expect(wrapper.text()).toContain('未評価')
    })

    it('読みたい本でも評価できる', async () => {
      const fetchMock = stubServer({ ...baseBook, status: 'want', rating: 0 })
      const { wrapper } = await mountAt('/books/7')

      await star(wrapper, 2).trigger('click')
      await flushPromises()

      expect(putBody(fetchMock)).toEqual({ rating: 2 })
    })
  })

  describe('感想', () => {
    it('感想を書いて保存すると、その項目だけを送る', async () => {
      const fetchMock = stubServer({ ...baseBook, review: null })
      const { wrapper } = await mountAt('/books/7')

      await wrapper.find('textarea').setValue('  とても良かった  ')
      await wrapper.find('form.space-y-2').trigger('submit')
      await flushPromises()

      expect(putBody(fetchMock)).toEqual({ review: 'とても良かった' })
      expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('とても良かった')
      expect(wrapper.find('form.space-y-2 button[type="submit"]').attributes('disabled')).toBeDefined()
    })

    it('空にして保存すると感想が消える', async () => {
      const fetchMock = stubServer()
      const { wrapper } = await mountAt('/books/7')

      await wrapper.find('textarea').setValue('')
      await wrapper.find('form.space-y-2').trigger('submit')
      await flushPromises()

      expect(putBody(fetchMock)).toEqual({ review: null })
    })
  })

  describe('更新中・失敗', () => {
    it('更新中は他の操作を無効にし、二重に送らない', async () => {
      let resolve!: (r: Response) => void
      const fetchMock = vi.fn<typeof fetch>((input, init) => {
        if (init?.method === 'PUT') return new Promise<Response>((r) => (resolve = r))
        return Promise.resolve(defaultSubResource(String(input)) ?? Response.json(baseBook))
      })
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper } = await mountAt('/books/7')

      await star(wrapper, 5).trigger('click')
      expect(wrapper.findAll('[role="radio"]').every((s) => s.attributes('disabled') !== undefined)).toBe(true)
      expect(button(wrapper, '読了にする').attributes('disabled')).toBeDefined()
      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()

      await star(wrapper, 3).trigger('click')
      expect(callsOf(fetchMock, 'PUT')).toHaveLength(1)

      resolve(Response.json({ ...baseBook, rating: 5 }))
      await flushPromises()
      expect(button(wrapper, '読了にする').attributes('disabled')).toBeUndefined()
    })

    it('失敗したらエラーを表示し、書きかけの感想は残り、再操作できる', async () => {
      let fail = true
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: unknown, init?: RequestInit) => {
          if (init?.method !== 'PUT') return defaultSubResource(String(input)) ?? Response.json(baseBook)
          return fail
            ? Response.json({ error: '保存できませんでした' }, { status: 500 })
            : Response.json({ ...baseBook, rating: 5 })
        }),
      )
      const { wrapper } = await mountAt('/books/7')
      await wrapper.find('textarea').setValue('書きかけの感想')

      await star(wrapper, 5).trigger('click')
      await flushPromises()

      expect(wrapper.find('[role="alert"]').text()).toContain('保存できませんでした')
      expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('書きかけの感想')
      expect(star(wrapper, 5).attributes('disabled')).toBeUndefined()

      fail = false
      await star(wrapper, 5).trigger('click')
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(checkedStar(wrapper)).toBe('5つ星')
    })

    it('評価を更新しても、書きかけの感想は消えない', async () => {
      stubServer()
      const { wrapper } = await mountAt('/books/7')
      await wrapper.find('textarea').setValue('書きかけの感想')

      await star(wrapper, 5).trigger('click')
      await flushPromises()

      expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('書きかけの感想')
    })
  })
})

describe('BookDetailView の読書ログ', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const dateInput = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) => wrapper.find('input[type="date"]')
  // 読書中は「現在のページ」欄もあるため、読書ログの入力欄はセクション内から探す
  const pagesInput = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
    wrapper.find('[aria-label="読書ログ"] input[type="number"]')

  it('読みたい本には読書ログのセクションを表示しない', async () => {
    stubServer({ ...baseBook, status: 'want', current_page: null })
    const { wrapper } = await mountAt('/books/7')
    expect(wrapper.find('[aria-label="読書ログ"]').exists()).toBe(false)
  })

  it('読書中の本には記録フォームと履歴を表示する', async () => {
    stubServer(baseBook, [{ id: 1, book_id: 7, date: '2026-09-20', pages: 30 }])
    const { wrapper } = await mountAt('/books/7')

    const section = wrapper.find('[aria-label="読書ログ"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('2026-09-20（30ページ）')
    expect(dateInput(wrapper).exists()).toBe(true)
  })

  it('記録すると一覧に追加され、現在のページが更新される', async () => {
    const fetchMock = stubServer()
    const { wrapper } = await mountAt('/books/7')

    await dateInput(wrapper).setValue('2026-09-21')
    await pagesInput(wrapper).setValue('30')
    await wrapper.find('[aria-label="読書ログ"] form').trigger('submit')
    await flushPromises()

    expect(callsOf(fetchMock, 'POST').some(([p]) => String(p).endsWith('/logs'))).toBe(true)
    const section = wrapper.find('[aria-label="読書ログ"]')
    expect(section.text()).toContain('2026-09-21（30ページ）')
    expect(wrapper.text()).toContain('80 / 200 ページ（40%）')
  })

  it('削除すると一覧から消え、現在のページが戻る', async () => {
    stubServer(baseBook, [{ id: 1, book_id: 7, date: '2026-09-20', pages: 30 }])
    const { wrapper } = await mountAt('/books/7')

    await wrapper.find('[aria-label="読書ログ"] button.text-red-700').trigger('click')
    await flushPromises()

    const section = wrapper.find('[aria-label="読書ログ"]')
    expect(section.text()).not.toContain('2026-09-20')
    expect(section.text()).toContain('まだ記録がありません')
    expect(wrapper.text()).toContain('20 / 200 ページ（10%）')
  })

  it('読了した本は履歴だけ表示し、記録フォーム・削除ボタンは出さない', async () => {
    stubServer({ ...baseBook, status: 'done', finished_at: '2026-03-04T12:00:00.000Z' }, [
      { id: 1, book_id: 7, date: '2026-09-20', pages: 30 },
    ])
    const { wrapper } = await mountAt('/books/7')

    const section = wrapper.find('[aria-label="読書ログ"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('2026-09-20（30ページ）')
    expect(section.find('form').exists()).toBe(false)
    expect(section.find('button.text-red-700').exists()).toBe(false)
  })

  it('直近の読書ログから算出できた読了予測を表示する', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input)
      const method = init?.method ?? 'GET'
      if (path.endsWith('/prediction')) {
        return Response.json({ available: true, remainingPages: 100, pagesPerDay: 10, estimatedDays: 10 })
      }
      if (path.includes('/logs') || path.includes('/quotes')) return Response.json([])
      if (path.startsWith('/api/books/') && method === 'GET') return Response.json(baseBook)
      return Response.json({ error: 'unexpected' }, { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { wrapper } = await mountAt('/books/7')

    expect(wrapper.find('[aria-label="読書ログ"]').text()).toContain('あと約10日で読み終わりそうです')
  })
})

describe('BookDetailView の引用', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('引用を追加すると一覧に表示される', async () => {
    const fetchMock = stubServer()
    const { wrapper } = await mountAt('/books/7')

    const section = wrapper.find('[aria-label="引用"]')
    await section.find('textarea').setValue('吾輩は猫である。名前はまだ無い。')
    await section.find('input[type="number"]').setValue('1')
    await section.find('form').trigger('submit')
    await flushPromises()

    expect(callsOf(fetchMock, 'POST').some(([p]) => String(p).endsWith('/quotes'))).toBe(true)
    expect(section.text()).toContain('吾輩は猫である。名前はまだ無い。')
    expect(section.text()).toContain('p.1')
  })

  it('削除すると一覧から消える', async () => {
    stubServer(baseBook, [], [{ id: 1, book_id: 7, text: '消す引用', page: null }])
    const { wrapper } = await mountAt('/books/7')

    const section = wrapper.find('[aria-label="引用"]')
    expect(section.text()).toContain('消す引用')

    await section.find('button.text-red-700').trigger('click')
    await flushPromises()

    expect(section.text()).not.toContain('消す引用')
    expect(section.text()).toContain('まだ引用がありません')
  })

  it('読みたい本・読了した本でも引用のセクションを表示する', async () => {
    stubServer({ ...baseBook, status: 'want', current_page: null }, [], [{ id: 1, book_id: 7, text: '引用', page: null }])
    const { wrapper } = await mountAt('/books/7')
    expect(wrapper.find('[aria-label="引用"]').text()).toContain('引用')
  })
})
