import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

/**
 * デモ動画の録画用（`npm run demo:record`）。E2E テストとは別に、デモ専用のDBでアプリを起動して操作を録画する。
 * ポートは開発サーバーと同じ固定（5173 / 8080）。使用中なら失敗させる（本番DBで動いている devサーバーを使わないため）。
 */
const dataDir = fileURLToPath(new URL('./.data/', import.meta.url))
mkdirSync(dataDir, { recursive: true })

export default defineConfig({
  testDir: '.',
  testMatch: 'record.demo.ts',
  outputDir: './.output',
  timeout: 180_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
    video: { mode: 'on', size: { width: 1280, height: 800 } },
    // 見ている人が操作を追えるよう、1つ1つの操作をゆっくりにする
    launchOptions: { slowMo: 120 },
    colorScheme: 'light',
    locale: 'ja-JP',
  },
  webServer: [
    {
      command: 'npm run start',
      cwd: '../../backend',
      env: { DB_PATH: `${dataDir}demo.db` },
      url: 'http://127.0.0.1:8080/api/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev',
      cwd: '../..',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
    },
  ],
})
