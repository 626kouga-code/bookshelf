import { afterEach, describe, it, expect, vi } from 'vitest'

import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import router from '../router'

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ヘッダーとホーム画面を表示する', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('読書管理アプリ')
    expect(wrapper.text()).toContain('本棚はまだ空です')
  })
})
