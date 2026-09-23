import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import SettingsView from '../SettingsView.vue'

function stubFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn<typeof fetch>(async (input, init) => handler(new URL(String(input), 'http://localhost'), init))
  vi.stubGlobal('fetch', fn)
  return fn
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', component: SettingsView },
      { path: '/', component: { template: '<div>home</div>' } },
    ],
  })
  await router.push('/settings')
  await router.isReady()
  const wrapper = mount(SettingsView, { global: { plugins: [router] } })
  return { wrapper, router }
}

const backupData = { version: 1, exported_at: '2026-09-23T00:00:00.000Z', books: [], reading_logs: [], quotes: [], goals: [] }

describe('SettingsView', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  let createObjectURL: ReturnType<typeof vi.fn<typeof URL.createObjectURL>>
  let revokeObjectURL: ReturnType<typeof vi.fn<typeof URL.revokeObjectURL>>
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createObjectURL = vi.fn<typeof URL.createObjectURL>(() => 'blob:mock-url')
    revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  describe('エクスポート', () => {
    it('ボタンを押すとJSONをダウンロードする', async () => {
      stubFetch(() => Response.json(backupData))
      const { wrapper } = await mountView()

      await wrapper.find('[aria-label="エクスポート"] button').trigger('click')
      await flushPromises()

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('失敗したらエラーを表示する', async () => {
      stubFetch(() => Response.json({ error: 'エクスポートに失敗しました' }, { status: 500 }))
      const { wrapper } = await mountView()

      await wrapper.find('[aria-label="エクスポート"] button').trigger('click')
      await flushPromises()

      expect(wrapper.find('[aria-label="エクスポート"] [role="alert"]').text()).toContain('エクスポートに失敗しました')
    })
  })

  describe('インポート', () => {
    const selectFile = async (wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], content: string) => {
      const input = wrapper.find('input[type="file"]')
      const file = new File([content], 'backup.json', { type: 'application/json' })
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')
    }

    it('確認してからインポートし、成功したら本棚へ戻る', async () => {
      const fetchMock = stubFetch((url) =>
        url.pathname === '/api/import'
          ? Response.json({ books: 1, reading_logs: 0, quotes: 0, goals: 0 })
          : Response.json(backupData),
      )
      const { wrapper, router } = await mountView()

      await selectFile(wrapper, JSON.stringify(backupData))
      await flushPromises()

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('置き換わります'))
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/import'))).toBe(true)
      expect(router.currentRoute.value.path).toBe('/')
    })

    it('確認でキャンセルしたらインポートしない', async () => {
      vi.mocked(window.confirm).mockReturnValue(false)
      const fetchMock = stubFetch(() => Response.json(backupData))
      const { wrapper, router } = await mountView()

      await selectFile(wrapper, JSON.stringify(backupData))
      await flushPromises()

      expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/import'))).toBe(false)
      expect(router.currentRoute.value.path).toBe('/settings')
    })

    it('不正なJSONファイルはエラーを表示する', async () => {
      const fetchMock = stubFetch(() => Response.json(backupData))
      const { wrapper } = await mountView()

      await selectFile(wrapper, '{ this is not json')
      await flushPromises()

      expect(wrapper.find('[aria-label="インポート"] [role="alert"]').text()).toContain('JSONとして読み込めませんでした')
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/import'))).toBe(false)
    })

    it('APIが失敗したらエラーを表示する', async () => {
      stubFetch((url) =>
        url.pathname === '/api/import'
          ? Response.json({ error: '形式が正しくありません' }, { status: 400 })
          : Response.json(backupData),
      )
      const { wrapper, router } = await mountView()

      await selectFile(wrapper, JSON.stringify(backupData))
      await flushPromises()

      expect(wrapper.find('[aria-label="インポート"] [role="alert"]').text()).toContain('形式が正しくありません')
      expect(router.currentRoute.value.path).toBe('/settings')
    })
  })
})
