---
name: quality-check
description: |
  このリポジトリでコードをコミット・PR作成する前に必ず使う。フロントエンド・
  バックエンド(存在する場合)のlint・テスト・ビルドを一通り実行する手順をまとめたもの。
  「品質チェックして」「PRを作る前に確認して」「コミットする前にチェックして」と
  言われたときに参照する。
---

# 品質チェック手順

コミット・PR作成前に、変更のあった領域ごとに以下を実行する。すべて成功してからコミット・PR作成に進む。

## フロントエンド（リポジトリ直下、`src/` 配下などを変更した場合）

```bash
npm run lint
npm run test
npm run build
```

- `npm run lint`: [eslint.config.ts](../../../eslint.config.ts) によるチェック（Vue + TypeScript）。エラーが出たら修正してから再実行する。
- `npm run test`: Vitest による単体テスト（`vitest run`。一度実行して終了する）。
- `npm run build`: `vue-tsc` による型チェックと `vite build`。

## バックエンド（`backend/` が存在し、その配下を変更した場合）

```bash
npm run lint          # リポジトリ直下で実行（backend/ もルートのESLint設定の対象）
cd backend
npm run type-check
npm run test
```

- `npm run type-check`: `tsc --noEmit` による型チェック。バックエンドは `tsx` で直接実行するためビルド工程はない。
- `npm run test`: Vitest による単体テスト（Honoの `app.request()` + メモリ上のSQLite）。ルートの `npm run test` は `backend/` を対象外にしているため、`backend/` で別途実行する。

## E2Eテスト（画面・APIの挙動に関わる変更をした場合）

```bash
npm run test:e2e
```

- Playwright（Chromium）で、ブラウザ＋バックエンドを通した主要な操作を確認する（テストは [e2e/](../../../e2e/)）。
- 実行時にフロント（5173）・バックエンド（8080）を自動で起動する。バックエンドは本番DBではなく `e2e/.data/e2e.db` を使い、各テストの前にインポートAPIで空にする。
- ポートが使用中だと既存サーバーを流用せずに失敗する（本番DBで動いているdevサーバーのデータを書き換えないため）。自分が起動したdevサーバーが残っていれば、[dev-server-ports](../dev-server-ports/SKILL.md) の手順で止めてから実行する。見覚えのないプロセスなら止めずにユーザーに確認する。
- 初回のみ `npx playwright install chromium` が必要。

## 適用範囲

PRを作る前、および「品質チェックして」と依頼されたときは、変更されたディレクトリに対応するチェックをすべて実行する。フロントとバックエンドの両方に変更がある場合は、両方を実行する。ドキュメントだけの変更でも、`npm run lint` は実行して壊れていないことを確認する。
