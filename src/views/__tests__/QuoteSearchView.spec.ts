import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { QuoteSearchResult } from '@/api/books'
import QuoteSearchView from '../QuoteSearchView.vue'

function makeQuote(overrides: Partial<QuoteSearchResult> = {}): QuoteSearchResult {
  return { id: 1, book_id: 1, text: '引用文', page: null, book_title: '本のタイトル', ...overrides }
}

function stubFetch(handler: (url: URL) => Response | Promise<Response>) {
  const fn = vi.fn(async (input: unknown) => handler(new URL(String(input), 'http://localhost')))
  vi.stubGlobal('fetch', fn)
  return fn
}

const lastQuery = (fn: ReturnType<typeof stubFetch>) =>
  Object.fromEntries(new URL(String(fn.mock.lastCall![0]), 'http://localhost').searchParams)

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/quotes', component: QuoteSearchView },
      { path: '/books/:id', component: { template: '<div>book</div>' } },
    ],
  })
  await router.push('/quotes')
  await router.isReady()
  const wrapper = mount(QuoteSearchView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('QuoteSearchView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('表示時に全件を取得する', async () => {
    const fetchMock = stubFetch(() => Response.json([makeQuote({ text: 'a' }), makeQuote({ id: 2, text: 'b' })]))
    const wrapper = await mountView()

    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(lastQuery(fetchMock).q).toBeUndefined()
  })

  it('引用がなければ「まだ引用がありません」を表示する', async () => {
    stubFetch(() => Response.json([]))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('まだ引用がありません')
  })

  it('本のタイトルとページ番号を表示し、本にリンクする', async () => {
    stubFetch(() => Response.json([makeQuote({ text: '引用', page: 42, book_id: 7, book_title: '吾輩は猫である' })]))
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('引用')
    expect(wrapper.text()).toContain('吾輩は猫である')
    expect(wrapper.text()).toContain('p.42')
    expect(wrapper.find('a[href="/books/7"]').exists()).toBe(true)
  })

  it('ページ番号がなければ表示しない', async () => {
    stubFetch(() => Response.json([makeQuote({ page: null })]))
    const wrapper = await mountView()
    expect(wrapper.text()).not.toContain('p.')
  })

  it('検索語は入力が止まってから1回だけ取得し直す', async () => {
    const fetchMock = stubFetch(() => Response.json([]))
    const wrapper = await mountView()
    const input = wrapper.find('input[type="search"]')

    await input.setValue('猫')
    await input.setValue('猫の')
    await vi.advanceTimersByTimeAsync(299)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(lastQuery(fetchMock).q).toBe('猫の')
  })

  it('検索語がなければ「まだ引用がありません」、条件に合わなければ「条件に合う引用はありません」を表示する', async () => {
    const fetchMock = stubFetch(() => Response.json([]))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('まだ引用がありません')

    await wrapper.find('input[type="search"]').setValue('見つからない')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('条件に合う引用はありません')
  })

  it('取得に失敗したらエラーを表示し、再読み込みで復旧できる', async () => {
    let fail = true
    const fetchMock = stubFetch(() =>
      fail ? Response.json({ error: '検索に失敗しました' }, { status: 500 }) : Response.json([makeQuote()]),
    )
    const wrapper = await mountView()
    expect(wrapper.find('[role="alert"]').text()).toContain('検索に失敗しました')

    fail = false
    await wrapper.find('[role="alert"] button').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('引用文')
  })
})
