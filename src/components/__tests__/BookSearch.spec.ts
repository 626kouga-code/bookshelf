import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BookSearch from '../BookSearch.vue'

const volume = (title: string, extra: Record<string, unknown> = {}) => ({
  volumeInfo: { title, authors: ['著者'], ...extra },
})

function stubFetch(handler: (url: URL) => Response | Promise<Response>) {
  const fn = vi.fn<typeof fetch>(async (input) => handler(new URL(String(input))))
  vi.stubGlobal('fetch', fn)
  return fn
}

async function search(wrapper: ReturnType<typeof mount>, text: string) {
  await wrapper.find('input[type="search"]').setValue(text)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('BookSearch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('検索すると候補を一覧表示する', async () => {
    stubFetch(() =>
      Response.json({
        items: [volume('リーダブルコード', { pageCount: 260, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9784873115658' }] }), volume('別の本')],
      }),
    )
    const wrapper = mount(BookSearch)
    await search(wrapper, 'リーダブル')

    const items = wrapper.findAll('ul[aria-label="検索結果"] li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('リーダブルコード')
    expect(items[0]!.text()).toContain('ISBN 9784873115658')
    expect(items[0]!.text()).toContain('260ページ')
  })

  it('候補を選ぶと select で書誌情報を渡す', async () => {
    stubFetch(() => Response.json({ items: [volume('a'), volume('b', { pageCount: 100 })] }))
    const wrapper = mount(BookSearch)
    await search(wrapper, 'x')

    await wrapper.findAll('ul[aria-label="検索結果"] button')[1]!.trigger('click')

    expect(wrapper.emitted('select')![0]).toEqual([{ title: 'b', authors: ['著者'], pages: 100 }])
  })

  it('0件なら「見つかりませんでした」を表示する', async () => {
    stubFetch(() => Response.json({ totalItems: 0 }))
    const wrapper = mount(BookSearch)
    await search(wrapper, 'x')
    expect(wrapper.text()).toContain('見つかりませんでした')
  })

  it('失敗したらエラーと手入力の案内を表示し、再検索で復旧できる', async () => {
    let fail = true
    stubFetch(() => (fail ? new Response('', { status: 429 }) : Response.json({ items: [volume('a')] })))
    const wrapper = mount(BookSearch)

    await search(wrapper, 'x')
    const alert = wrapper.find('[role="alert"]').text()
    expect(alert).toContain('利用上限')
    expect(alert).toContain('手入力')
    expect(wrapper.find('ul').exists()).toBe(false)

    fail = false
    await search(wrapper, 'x')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('ul[aria-label="検索結果"] li')).toHaveLength(1)
  })

  it('検索語が空なら検索できない', async () => {
    const fetchMock = stubFetch(() => Response.json({}))
    const wrapper = mount(BookSearch)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('連続して検索したとき、古い検索の結果は捨てる', async () => {
    let resolveFirst!: (r: Response) => void
    let call = 0
    stubFetch(() => {
      call++
      return call === 1 ? new Promise<Response>((r) => (resolveFirst = r)) : Response.json({ items: [volume('新しい')] })
    })
    const wrapper = mount(BookSearch)

    await wrapper.find('input[type="search"]').setValue('古い')
    void wrapper.find('form').trigger('submit')
    await flushPromises()
    await search(wrapper, '新しい')

    resolveFirst(Response.json({ items: [volume('古い結果')] }))
    await flushPromises()

    const titles = wrapper.findAll('ul[aria-label="検索結果"] li').map((li) => li.text())
    expect(titles).toHaveLength(1)
    expect(titles[0]).toContain('新しい')
  })
})
