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

```bash
cd backend
npm install
npm run dev
```

`http://127.0.0.1:8080` で起動します（ポート固定・外部には公開しない）。DBは `backend/data/reading.db` です（`DB_PATH` で変更可）。

### 本番用のコンテナ（Docker）

画面（Caddy で配信）とバックエンドを Docker Compose で起動します。構成は [infra/docker/](./infra/docker/) にあります。

```bash
# 手元で試す（HTTPのみ。http://localhost/ で開く）
docker compose -f infra/docker/docker-compose.prod.yml up -d --build

# 本番（ドメインを渡すと Let's Encrypt の証明書を自動で取得して HTTPS になる）
SITE_ADDRESS=3-115-117-197.sslip.io docker compose -f infra/docker/docker-compose.prod.yml up -d --build
```

- DBと証明書は Docker のボリューム（`reading-data`・`caddy-data`）に保存され、コンテナを作り直しても残ります
- Google Books APIキーは、ビルド時に環境変数 `VITE_GOOGLE_BOOKS_API_KEY` で渡します（無くても動きます）
- 手元で 80/443 が使用中なら `HTTP_PORT`・`HTTPS_PORT` で公開するポートを変えられます

### AWS（Terraform）

本番のサーバー（EC2）は [infra/terraform/](./infra/terraform/) で作ります。AWS CLI のプロファイル `trello-app`（ap-northeast-1）を使います。

```bash
# 初回のみ: SSH鍵を作る（秘密鍵は Git 管理外）
ssh-keygen -t ed25519 -N "" -C reading-app -f infra/reading-app-key

cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # 自分のIP（/32）と課金アラートの通知先を書く
terraform init
terraform plan -out=tfplan   # 作られるものを確認してから
terraform apply tfplan
```

- 作られるもの: EC2 `t4g.micro`（ディスク10GB）、固定IP（Elastic IP）、セキュリティグループ、SSH鍵、課金アラート（AWS Budgets）
- SSH（22）とアプリ（443）は自分のIPだけに許可しています。80番は Let's Encrypt の証明書取得と HTTPS への転送のためだけに全体へ開けています
- 自宅のIPが変わったら `terraform.tfvars` の `my_ip_cidr` を直して `terraform apply` し直します
- 費用は無料プランのクレジットから引かれます（目安: 月12〜13ドル）

## 品質チェック

```bash
npm run lint    # ESLint
npm run test    # Vitest
npm run build   # 型チェック + ビルド
npm run test:e2e  # Playwright（E2E）
```

E2Eテストは、初回のみ `npx playwright install chromium` でブラウザを入れておきます。実行時にフロント（5173）とバックエンド（8080）をE2E専用のDB（`e2e/.data/`）で自動起動するため、devサーバーは止めてから実行してください（ポートが使用中なら失敗します）。

コミット・PR作成前の手順は [.claude/skills/quality-check/SKILL.md](./.claude/skills/quality-check/SKILL.md) にまとめています。
