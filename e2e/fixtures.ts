import { test as base, expect } from '@playwright/test'

/** 空のバックアップ。インポートすると全データが消える。 */
const EMPTY_BACKUP = { version: 1, books: [], reading_logs: [], quotes: [], goals: [] }

/**
 * 各テストの前に、DBを空にし、Google Books APIへの外部通信を遮断する。
 * テストは `import { test, expect } from './fixtures'` で使う。
 */
export const test = base.extend<{ resetData: void }>({
  resetData: [
    async ({ page, request }, use) => {
      const res = await request.post('http://127.0.0.1:8080/api/import', { data: EMPTY_BACKUP })
      expect(res.ok()).toBe(true)
      await page.route('https://www.googleapis.com/**', (route) => route.abort())
      await use()
    },
    { auto: true },
  ],
})

export { expect }

/** ブラウザのタイムゾーンでの今日の日付（YYYY-MM-DD）。読書ログの日付入力の既定値と同じ形式。 */
export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
