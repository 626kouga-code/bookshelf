import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import BookNewView from '../BookNewView.vue'

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>shelf</div>' } },
      { path: '/books/new', component: BookNewView },
    ],
  })
  await router.push('/books/new')
  await router.isReady()
  const wrapper = mount(BookNewView, { global: { plugins: [router] } })
  return { wrapper, router }
}

async function fillAndSubmit(wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], title = '吾輩は猫である') {
  await wrapper.find('input[type="text"]').setValue(title)
  await wrapper.find('form[novalidate]').trigger('submit')
  await flushPromises()
}

describe('BookNewView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('登録に成功したら本を送って本棚へ戻る', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: 1 }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountView()

    await fillAndSubmit(wrapper)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
      title: '吾輩は猫である',
      status: 'want',
    })
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('ISBN重複（409）ならメッセージを表示して画面に留まる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: '同じISBNの本が既に登録されています' }, { status: 409 })),
    )
    const { wrapper, router } = await mountView()

    await fillAndSubmit(wrapper)

    expect(wrapper.find('[role="alert"]').text()).toContain('同じISBNの本が既に登録されています')
    expect(router.currentRoute.value.path).toBe('/books/new')
  })

  it('通信に失敗したらメッセージを表示し、再送信できる', async () => {
    let fail = true
    const fetchMock = vi.fn<typeof fetch>(async () => {
      if (fail) throw new TypeError('Failed to fetch')
      return Response.json({ id: 1 }, { status: 201 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountView()

    await fillAndSubmit(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('サーバーに接続できません')
    expect(wrapper.find('form[novalidate] button[type="submit"]').attributes('disabled')).toBeUndefined()

    fail = false
    await wrapper.find('form[novalidate]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('送信中に再度送信しても二重に登録しない', async () => {
    let resolve!: (r: Response) => void
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>((r) => (resolve = r)))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountView()

    await wrapper.find('input[type="text"]').setValue('a')
    await wrapper.find('form[novalidate]').trigger('submit')
    await wrapper.find('form[novalidate]').trigger('submit')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolve(Response.json({ id: 1 }, { status: 201 }))
    await flushPromises()
  })
})

describe('BookNewView の Google Books 連携', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const googleResponse = {
    items: [
      {
        volumeInfo: {
          title: 'リーダブルコード',
          authors: ['Dustin Boswell'],
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9784873115658' }],
          pageCount: 260,
        },
      },
    ],
  }

  it('検索して候補を選ぶとフォームに入力され、そのまま登録できる', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      String(input).startsWith('https://www.googleapis.com/')
        ? Response.json(googleResponse)
        : Response.json({ id: 1 }, { status: 201 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountView()

    await wrapper.find('input[type="search"]').setValue('9784873115658')
    await wrapper.find('form:not([novalidate])').trigger('submit')
    await flushPromises()
    await wrapper.find('ul[aria-label="検索結果"] button').trigger('click')
    await flushPromises()

    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('リーダブルコード')

    await wrapper.find('form[novalidate]').trigger('submit')
    await flushPromises()

    const postCall = fetchMock.mock.calls.find(([url]) => url === '/api/books')!
    expect(JSON.parse(String(postCall[1]?.body))).toEqual({
      title: 'リーダブルコード',
      authors: ['Dustin Boswell'],
      isbn: '9784873115658',
      pages: 260,
      status: 'want',
    })
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('検索に失敗しても手入力で登録できる', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      String(input).startsWith('https://www.googleapis.com/')
        ? new Response('', { status: 429 })
        : Response.json({ id: 1 }, { status: 201 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountView()

    await wrapper.find('input[type="search"]').setValue('猫')
    await wrapper.find('form:not([novalidate])').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('利用上限')

    await fillAndSubmit(wrapper, '手入力の本')
    expect(router.currentRoute.value.path).toBe('/')
  })
})
