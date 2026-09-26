import { afterEach, describe, it, expect, vi } from 'vitest'

import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import router from '../router'

async function mountApp(path: string) {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return wrapper
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ヘッダーとホーム画面を表示する', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    const wrapper = await mountApp('/')

    expect(wrapper.text()).toContain('読書管理アプリ')
    expect(wrapper.text()).toContain('本棚はまだ空です')
  })

  it('ナビゲーションから本の追加画面へ移動できる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    const wrapper = await mountApp('/')

    await wrapper.find('nav a[href="/books/new"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('本を追加')
  })

  it('ナビゲーションから引用検索画面へ移動できる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    const wrapper = await mountApp('/')

    await wrapper.find('nav a[href="/quotes"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('引用検索')
  })

  it('ナビゲーションから統計・目標画面へ移動できる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const url = new URL(String(input), 'http://localhost')
        if (url.pathname === '/api/stats') {
          return Response.json({ monthly_finished: [], genre_counts: [], total_pages_read: 0, current_streak_days: 0, daily_pages: [] })
        }
        if (url.pathname === '/api/goals') {
          const periodType = url.searchParams.get('period_type')
          return Response.json({
            period_type: periodType,
            period: url.searchParams.get('period') ?? '',
            target_books: null,
            target_daily_pages: null,
          })
        }
        return Response.json([])
      }),
    )
    const wrapper = await mountApp('/')

    await wrapper.find('nav a[href="/stats"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('統計・目標')
  })

  it('ナビゲーションから設定画面へ移動できる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    const wrapper = await mountApp('/')

    await wrapper.find('nav a[href="/settings"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('h2').text()).toBe('設定')
  })

  it('現在のページのナビゲーションだけを強調する', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    const wrapper = await mountApp('/books/new')

    const current = (href: string) => wrapper.find(`nav a[href="${href}"]`).attributes('aria-current')
    expect(current('/books/new')).toBe('page')
    expect(current('/')).toBeUndefined()
  })
})
