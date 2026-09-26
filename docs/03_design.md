# データモデル・API・画面構成

> 読書管理アプリ 要件定義書 — Part 3/4
> 関連ドキュメント: [概要・目的・対象ユーザー](./01_overview.md) | [非機能・機能要件](./02_requirements.md) | [スコープ外・拡張候補](./04_scope.md)

## 6. データモデル（SQLite）

### books
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | INTEGER PK | 本のID |
| title | TEXT NOT NULL | タイトル |
| authors | TEXT | 著者（JSON配列の文字列） |
| isbn | TEXT UNIQUE | ISBN（13桁に正規化。未入力はNULL） |
| pages | INTEGER | 総ページ数 |
| cover | TEXT | 表紙画像URL |
| genre | TEXT | ジャンル |
| status | TEXT NOT NULL | `want`（読みたい）/ `reading`（読書中）/ `done`（読了） |
| current_page | INTEGER | 現在のページ |
| rating | INTEGER | 星評価（0〜5。0は未評価） |
| review | TEXT | 感想メモ |
| added_at | TEXT | 登録日時（ISO 8601） |
| finished_at | TEXT | 読了日（`done` にした日に自動設定） |

### reading_logs
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | INTEGER PK | ログID |
| book_id | INTEGER FK → books.id | 対象の本（本の削除時に連動して削除） |
| date | TEXT | 読んだ日（`YYYY-MM-DD`） |
| pages | INTEGER | その日に読んだページ数 |

### quotes
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | INTEGER PK | 引用ID |
| book_id | INTEGER FK → books.id | 対象の本（本の削除時に連動して削除） |
| text | TEXT NOT NULL | 引用文 |
| page | INTEGER | ページ番号（任意） |

### goals
| 列 | 型 | 説明 |
| --- | --- | --- |
| id | INTEGER PK | 目標ID |
| period_type | TEXT | `year` / `month` |
| period | TEXT | `YYYY`（年）または `YYYY-MM`（月） |
| target_books | INTEGER | 目標冊数 |
| target_daily_pages | INTEGER | 1日あたりの目標ページ数 |

`period_type` と `period` の組み合わせは一意とする。

## 7. API（REST / JSON、ベースパス `/api`）

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/health` | 動作確認 |
| GET | `/api/books` | 本の一覧（下記のクエリで絞り込み・並べ替え・キーワード検索） |
| POST | `/api/books` | 本の登録。同じISBNが既にある場合は `409` |
| GET / PUT / DELETE | `/api/books/:id` | 本の取得・更新・削除。状態を `done` に更新すると `finished_at` を自動設定（`done` から戻すと解除）。`PUT` は送った項目のみ更新する部分更新 |
| POST | `/api/books/:id/logs` | 読書ログの追加 |
| POST | `/api/books/:id/quotes` | 引用の追加 |
| GET | `/api/quotes?q=` | 引用の横断検索 |
| GET | `/api/stats` | 統計（月別読了数、ジャンル別、累計ページ、連続読書日数、直近53週の日別ページ数） |
| GET / PUT | `/api/goals` | 読書目標の取得・設定 |
| GET | `/api/export` | 全データをJSONで出力 |
| POST | `/api/import` | JSONから全データを復元 |

### `GET /api/books` のクエリパラメータ

すべて任意。空文字は指定なしとして扱い、不正な値は `400`。絞り込みは AND で組み合わせる。

| パラメータ | 内容 |
| --- | --- |
| `status` | `want` / `reading` / `done` |
| `genre` | ジャンルの完全一致 |
| `rating` | 星評価の完全一致（0〜5。0は未評価） |
| `author` | 著者の完全一致（複数著者のいずれか） |
| `q` | タイトル・著者の部分一致（英字は大文字小文字を区別しない） |
| `sort` | `added_at`（既定）/ `title` / `rating` / `finished_at` |
| `order` | `desc`（既定）/ `asc`。`sort` の値が未設定（NULL）の本は常に末尾 |

エラーは `{ "error": "メッセージ" }` 形式のJSONと適切なHTTPステータスで返す。

## 8. 画面構成

| 画面 | パス | 内容 |
| --- | --- | --- |
| 本棚 | `/` | 本の一覧。状態タブ、絞り込み、並べ替え、キーワード検索 |
| 本の追加 | `/books/new` | ISBN/タイトル検索と候補選択、手入力フォーム |
| 本の詳細 | `/books/:id` | 基本情報、進捗更新、読書ログ、評価・感想、引用 |
| 引用検索 | `/quotes` | 全本の引用をキーワード検索 |
| 統計・目標 | `/stats` | 読書ヒートマップ・グラフ（依存ライブラリを増やさずインラインSVG）、読書目標の設定と達成度 |
| 設定 | `/settings` | JSONエクスポート/インポート |

スマホ幅では、ヘッダーのナビゲーションを折りたたむなどして1カラムで表示する。

## 9. フロントエンドの構成

- `src/views/`: 画面（上表の各ルートに対応）
- `src/components/`: 再利用するコンポーネント
- `src/stores/`: Piniaストア（本、統計、目標）
- `src/api/`: バックエンドAPIとGoogle Books APIのクライアント
- `src/router/`: ルーティング
- テストは各ディレクトリの `__tests__/` に置く
