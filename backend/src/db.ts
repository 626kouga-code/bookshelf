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

export type Db = Database.Database

/** DBを開き、スキーマを初期化して返す。`:memory:` も指定できる。 */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}
