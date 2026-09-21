import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Book } from '@/api/books'
import HomeView from '../HomeView.vue'

function makeBook(id: number, title: string, extra: Partial<Book> = {}): Book {
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
    ...extra,
  }
}

function stubFetch(handler: (url: URL) => Response | Promise<Response>) {
  const fn = vi.fn(async (input: unknown) => handler(new URL(String(input), 'http://localhost')))
  vi.stubGlobal('fetch', fn)
  return fn
}

const lastQuery = (fn: ReturnType<typeof stubFetch>) =>
  Object.fromEntries(new URL(String(fn.mock.lastCall![0]), 'http://localhost').searchParams)

async function mountView() {
  const wrapper = mount(HomeView, { global: { plugins: [createPinia()] } })
  await flushPromises()
  return wrapper
}

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('本の一覧を表示する', async () => {
    stubFetch(() => Response.json([makeBook(1, 'Vue入門'), makeBook(2, 'TypeScript入門')]))
    const wrapper = await mountView()
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.text()).toContain('Vue入門')
    expect(wrapper.text()).toContain('TypeScript入門')
  })

  it('本がなければ「本棚はまだ空です」を表示する', async () => {
    stubFetch(() => Response.json([]))
    expect((await mountView()).text()).toContain('本棚はまだ空です')
  })

  it('取得に失敗したらエラーを表示し、再読み込みで復旧できる', async () => {
    let fail = true
    const fetchMock = stubFetch(() =>
      fail ? Response.json({ error: 'DBエラー' }, { status: 500 }) : Response.json([makeBook(1, 'a')]),
    )
    const wrapper = await mountView()
    expect(wrapper.find('[role="alert"]').text()).toContain('DBエラー')

    fail = false
    await wrapper.find('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('a')
  })

  it('状態タブを選ぶと、その状態で取得し直す', async () => {
    const fetchMock = stubFetch(() => Response.json([]))
    const wrapper = await mountView()
    expect(lastQuery(fetchMock).status).toBeUndefined()

    const tab = wrapper.findAll('[role="tab"]').find((t) => t.text() === '読了')!
    await tab.trigger('click')
    await flushPromises()

    expect(lastQuery(fetchMock).status).toBe('done')
    expect(tab.attributes('aria-selected')).toBe('true')
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

  it('並べ替えを変えると、その並びで取得し直す', async () => {
    const fetchMock = stubFetch(() => Response.json([]))
    const wrapper = await mountView()

    await wrapper.find('select').setValue('title:asc')
    await flushPromises()

    expect(lastQuery(fetchMock)).toMatchObject({ sort: 'title', order: 'asc' })
  })

  it('絞り込み結果が0件なら「条件に合う本はありません」を表示する', async () => {
    stubFetch(() => Response.json([]))
    const wrapper = await mountView()

    await wrapper.findAll('[role="tab"]')[3]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('条件に合う本はありません')
    expect(wrapper.text()).not.toContain('本棚はまだ空です')
  })
})
