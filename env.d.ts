/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Books APIキー（任意）。`.env.local` に書く。未設定でも検索できるが、利用上限に達しやすい。 */
  readonly VITE_GOOGLE_BOOKS_API_KEY?: string
}
