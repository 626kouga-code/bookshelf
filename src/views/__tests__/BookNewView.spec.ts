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
  await wrapper.find('form').trigger('submit')
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
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()

    fail = false
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('送信中に再度送信しても二重に登録しない', async () => {
    let resolve!: (r: Response) => void
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>((r) => (resolve = r)))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountView()

    await wrapper.find('input[type="text"]').setValue('a')
    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolve(Response.json({ id: 1 }, { status: 201 }))
    await flushPromises()
  })
})
