import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Book } from '@/api/books'
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

/** 本を1冊だけ持つ簡易サーバー。PUT は送られた項目でマージして返す。 */
function stubServer(initial: Book | null = baseBook) {
  let stored = initial
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    if (!path.startsWith('/api/books/')) return Response.json({ error: 'unexpected' }, { status: 500 })
    if (!stored) return Response.json({ error: '本が見つかりません' }, { status: 404 })
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
      expect(wrapper.find('[aria-label="評価 4"]').text()).toBe('★★★★☆')
      expect(wrapper.find('h3').text()).toBe('感想')
      // 改行を保って表示する（whitespace-pre-wrap）
      expect(wrapper.find('.whitespace-pre-wrap').element.textContent).toBe('面白かった\n二行目')
    })

    it('未入力の項目は表示しない', async () => {
      stubServer({ ...baseBook, authors: [], isbn: null, pages: null, genre: null, review: null, rating: 0, current_page: null })
      const { wrapper } = await mountAt('/books/7')
      const text = wrapper.text()
      for (const label of ['ISBN', '総ページ数', 'ジャンル', '感想', '読了日']) expect(text).not.toContain(label)
      expect(wrapper.find('[aria-label^="評価"]').exists()).toBe(false)
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
      expect(wrapper.find('form').exists()).toBe(false)
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
      expect(wrapper.find('form').exists()).toBe(false)
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
      const fetchMock = vi.fn<typeof fetch>(async (_input, init) =>
        init?.method === 'PUT'
          ? Response.json({ error: '同じISBNの本が既に登録されています' }, { status: 409 })
          : Response.json(baseBook),
      )
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper } = await mountAt('/books/7')
      await button(wrapper, '編集').trigger('click')
      await wrapper.find('input[type="text"]').setValue('編集中の題名')

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('[role="alert"]').text()).toContain('同じISBNの本が既に登録されています')
      expect(wrapper.find('form').exists()).toBe(true)
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
        vi.fn(async (_input: unknown, init?: RequestInit) =>
          init?.method === 'DELETE' ? new Response('boom', { status: 500 }) : Response.json(baseBook),
        ),
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
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      Response.json({ ...baseBook, id: Number(String(input).split('/').pop()), title: `本${String(input).split('/').pop()}` }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt('/books/1')
    expect(wrapper.find('h2').text()).toBe('本1')

    await router.push('/books/2')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('本2')
  })
})
