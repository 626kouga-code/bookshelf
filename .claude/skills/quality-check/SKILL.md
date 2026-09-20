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
cd backend
npm run lint
npm run test
npm run build
```

`backend/` を追加するPRで、このスキルのバックエンド節を実際のコマンドに合わせて更新すること。

## 適用範囲

PRを作る前、および「品質チェックして」と依頼されたときは、変更されたディレクトリに対応するチェックをすべて実行する。フロントとバックエンドの両方に変更がある場合は、両方を実行する。ドキュメントだけの変更でも、`npm run lint` は実行して壊れていないことを確認する。
