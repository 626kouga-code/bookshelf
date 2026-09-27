import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    VitePWA({
      // 新しいバージョンをデプロイしたら、次に開いたときに自動で切り替える
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '読書管理アプリ',
        short_name: '読書管理',
        description: '読んだ本・読みたい本と読書の記録を管理する',
        lang: 'ja',
        start_url: '/',
        display: 'standalone',
        background_color: '#fafaf9',
        theme_color: '#1c1917',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 画面一式（HTML・JS・CSS・アイコン）だけをキャッシュする。API（/api/*）はキャッシュせず、常にサーバーに問い合わせる
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      // 開発サーバーでは Service Worker を動かさない（キャッシュで変更が見えなくなるのを防ぐ）
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // ポート固定: 埋まっている場合は別ポートへ逃げずに起動失敗させる(.claude/skills/dev-server-ports 参照)
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        // バックエンドは 127.0.0.1 のみで待ち受けるため、localhost（::1 に解決され得る）は使わない
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
