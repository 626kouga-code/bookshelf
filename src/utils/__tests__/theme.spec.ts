import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  initTheme,
  loadThemeSetting,
  resolveTheme,
  saveThemeSetting,
  THEME_STORAGE_KEY,
} from '../theme'

/** matchMedia の差し替え。change を発火させる関数も返す。 */
function stubMatchMedia(prefersDark: boolean) {
  const listeners: (() => void)[] = []
  const media = {
    matches: prefersDark,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  return {
    change(dark: boolean) {
      media.matches = dark
      listeners.forEach((fn) => fn())
    },
  }
}

describe('theme', () => {
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    vi.unstubAllGlobals()
  })

  describe('loadThemeSetting / saveThemeSetting', () => {
    it('未保存なら system', () => {
      expect(loadThemeSetting()).toBe('system')
    })

    it('保存した設定を読み込む', () => {
      saveThemeSetting('dark')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
      expect(loadThemeSetting()).toBe('dark')
    })

    it('system に戻すと保存した値を消す', () => {
      saveThemeSetting('light')
      saveThemeSetting('system')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    })

    it('不正な値が保存されていたら system', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'blue')
      expect(loadThemeSetting()).toBe('system')
    })

    it('ストレージが使えなくてもエラーにしない', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('blocked')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('blocked')
      })
      expect(loadThemeSetting()).toBe('system')
      expect(() => saveThemeSetting('dark')).not.toThrow()
    })
  })

  describe('resolveTheme', () => {
    it('light / dark はそのまま、system はOSの設定に従う', () => {
      expect(resolveTheme('light', true)).toBe('light')
      expect(resolveTheme('dark', false)).toBe('dark')
      expect(resolveTheme('system', true)).toBe('dark')
      expect(resolveTheme('system', false)).toBe('light')
    })

    it('matchMedia が使えない環境では、system はライト', () => {
      expect(resolveTheme('system')).toBe('light')
    })
  })

  it('applyTheme は <html> の data-theme に反映する', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  describe('initTheme', () => {
    it('保存された設定を適用する', () => {
      stubMatchMedia(false)
      saveThemeSetting('dark')
      initTheme()
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    it('システムに合わせる設定なら、OSの設定の変更に追従する', () => {
      const media = stubMatchMedia(false)
      initTheme()
      expect(document.documentElement.dataset.theme).toBe('light')
      media.change(true)
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    it('ライト・ダークを選んでいるときは、OSの設定が変わっても変えない', () => {
      const media = stubMatchMedia(false)
      saveThemeSetting('light')
      initTheme()
      media.change(true)
      expect(document.documentElement.dataset.theme).toBe('light')
    })
  })
})
