import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  authors TEXT,
  isbn TEXT UNIQUE,
  pages INTEGER,
  cover TEXT,
  genre TEXT,
  status TEXT NOT NULL CHECK (status IN ('want', 'reading', 'done')),
  current_page INTEGER,
  rating INTEGER CHECK (rating BETWEEN 0 AND 5),
  review TEXT,
  added_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS reading_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  date TEXT,
  pages INTEGER
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  page INTEGER
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_type TEXT NOT NULL CHECK (period_type IN ('year', 'month')),
  period TEXT NOT NULL,
  target_books INTEGER,
  target_daily_pages INTEGER,
  UNIQUE (period_type, period)
);
`

/**
 * SCHEMA（初期の構造）に対する変更を順に並べる。適用済みの数は `PRAGMA user_version` に記録する。
 * 既存のDBにも新規のDBにも同じ手順で適用されるので、SCHEMA は書き換えずに、ここへ追記していく。
 */
const MIGRATIONS = [
  // 1: タグ・シリーズ・お気に入り
  `ALTER TABLE books ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1));
   ALTER TABLE books ADD COLUMN tags TEXT;
   ALTER TABLE books ADD COLUMN series TEXT;
   ALTER TABLE books ADD COLUMN volume INTEGER;`,
]

export type Db = Database.Database

/** 未適用のマイグレーションを順に適用する。途中で失敗したら、そのマイグレーションは丸ごと取り消す。 */
function migrate(db: Db) {
  const applied = db.pragma('user_version', { simple: true }) as number
  for (let v = applied; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!)
      db.pragma(`user_version = ${v + 1}`)
    })()
  }
}

/** DBを開き、スキーマを初期化して返す。`:memory:` も指定できる。 */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  migrate(db)
  return db
}
