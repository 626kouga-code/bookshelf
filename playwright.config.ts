import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/** E2E専用のDB。本番DB（backend/data/）は使わない。 */
const dataDir = fileURLToPath(new URL('./e2e/.data/', import.meta.url))
mkdirSync(dataDir, { recursive: true })

export default defineConfig({
  testDir: './e2e',
  // テストはバックエンドのDBを共有するので、1つずつ順番に実行する
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // ポートは固定（5173 / 8080）。使用中なら既存サーバーを流用せず失敗させる。
  // 本番DBで動いているdevサーバーに対してテストし、データを書き換えてしまうのを防ぐため。
  webServer: [
    {
      command: 'npm run start',
      cwd: './backend',
      env: { DB_PATH: `${dataDir}e2e.db` },
      url: 'http://127.0.0.1:8080/api/stats',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
    },
    // PWA（Service Worker）は開発サーバーでは動かさないため、ビルドした画面を vite preview で配信して確かめる。
    // /api は開発サーバーと同じくバックエンド（8080）へ転送される
    {
      command: 'npm run build-only && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
