/** テーマの設定。system はOSの設定（prefers-color-scheme）に合わせる。 */
export type ThemeSetting = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

/** 保存先のキー。index.html の描画前スクリプトも同じキーを読む。 */
export const THEME_STORAGE_KEY = 'reading-app:theme'

export const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'システムに合わせる' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
]

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isThemeSetting(value: unknown): value is ThemeSetting {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** 保存されたテーマ設定。未保存・不正な値・ストレージが使えない場合は system。 */
export function loadThemeSetting(): ThemeSetting {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeSetting(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

/** テーマ設定を保存する。ストレージが使えなくても、今の画面には適用できるので失敗は無視する。 */
export function saveThemeSetting(setting: ThemeSetting): void {
  try {
    if (setting === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, setting)
  } catch {
    // 保存できなくても、次回は system に戻るだけ
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

/** 設定とOSの設定から、実際に使うテーマを決める。 */
export function resolveTheme(setting: ThemeSetting, prefersDark = systemPrefersDark()): Theme {
  return setting === 'system' ? (prefersDark ? 'dark' : 'light') : setting
}

/** <html data-theme="..."> にテーマを反映する。CSSはこの属性を見て配色を切り替える。 */
export function applyTheme(setting: ThemeSetting): void {
  document.documentElement.dataset.theme = resolveTheme(setting)
}

/** 保存された設定を適用し、「システムに合わせる」のときはOSの設定の変更にも追従する。 */
export function initTheme(): void {
  applyTheme(loadThemeSetting())
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (loadThemeSetting() === 'system') applyTheme('system')
  })
}
