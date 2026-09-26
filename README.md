# bookshelf

読書管理アプリ。読んだ本・読んでいる本・読みたい本を記録し、読書の進捗や傾向を振り返るための個人向けツールです。Vue製フロントエンドとNode.js（Hono）バックエンドで構成し、データはSQLiteに保存します。

## 要件定義書

詳細な要件定義は以下に分割してあります。

1. [概要・目的・対象ユーザー](./docs/01_overview.md)
2. [非機能要件・機能要件](./docs/02_requirements.md)（技術スタックのバージョン一覧はこちら）
3. [データモデル・API・画面構成](./docs/03_design.md)
4. [スコープ外・拡張候補](./docs/04_scope.md)

開発ルール（Issue・ブランチ・PR・ポート固定）は [CLAUDE.md](./CLAUDE.md) を参照してください。

## 技術スタック

| レイヤー | 主な技術 |
| --- | --- |
| フロントエンド | Vue 3 + TypeScript + Vite、Pinia、Vue Router、Tailwind CSS |
| バックエンド | Node.js + TypeScript + Hono、REST API（`backend/`。今後追加） |
| データベース | SQLite |
| 外部API | Google Books API（書誌情報の検索） |
| テスト・lint | Vitest、Playwright（E2E）、ESLint |

## セットアップ・起動方法

### 前提

- Node.js v24（`^22.18.0 || >=24.12.0`）
- OneDriveの同期対象外のフォルダに置くこと（DBファイルや `node_modules` の競合を避けるため）

### フロントエンド

```bash
npm install
npm run dev
```

`http://localhost:5173` で起動します。ポートは固定のため、5173が使用中の場合は起動に失敗します（詳細は [.claude/skills/dev-server-ports/SKILL.md](./.claude/skills/dev-server-ports/SKILL.md)）。`/api` へのリクエストは、バックエンド（`8080`）へプロキシされます。

### バックエンド

`backend/` の追加後に手順を追記します。

## 品質チェック

```bash
npm run lint    # ESLint
npm run test    # Vitest
npm run build   # 型チェック + ビルド
npm run test:e2e  # Playwright（E2E）
```

E2Eテストは、初回のみ `npx playwright install chromium` でブラウザを入れておきます。実行時にフロント（5173）とバックエンド（8080）をE2E専用のDB（`e2e/.data/`）で自動起動するため、devサーバーは止めてから実行してください（ポートが使用中なら失敗します）。

コミット・PR作成前の手順は [.claude/skills/quality-check/SKILL.md](./.claude/skills/quality-check/SKILL.md) にまとめています。
