import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { openDb } from '../db.ts'

describe('openDb', () => {
  it('4つのテーブルを作成する', () => {
    const db = openDb(':memory:')
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => (r as { name: string }).name)
    expect(names.sort()).toEqual(['books', 'goals', 'quotes', 'reading_logs'])
  })

  it('本を削除すると読書ログと引用も連動して削除される', () => {
    const db = openDb(':memory:')
    db.prepare("INSERT INTO books (id, title, status) VALUES (1, 'a', 'want')").run()
    db.prepare("INSERT INTO reading_logs (book_id, date, pages) VALUES (1, '2026-01-01', 10)").run()
    db.prepare("INSERT INTO quotes (book_id, text) VALUES (1, 'q')").run()
    db.prepare('DELETE FROM books WHERE id = 1').run()
    expect(db.prepare('SELECT COUNT(*) AS n FROM reading_logs').get()).toEqual({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM quotes').get()).toEqual({ n: 0 })
  })

  it('同じISBNの本は登録できない', () => {
    const db = openDb(':memory:')
    const insert = db.prepare("INSERT INTO books (title, isbn, status) VALUES ('a', ?, 'want')")
    insert.run('9784000000000')
    expect(() => insert.run('9784000000000')).toThrow(/UNIQUE/)
  })

  describe('マイグレーション', () => {
    let dir: string | undefined

    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true })
      dir = undefined
    })

    const columns = (db: ReturnType<typeof openDb>) =>
      (db.prepare('PRAGMA table_info(books)').all() as { name: string }[]).map((c) => c.name)

    it('新規のDBにも、タグ・シリーズ・お気に入りの列が追加される', () => {
      const db = openDb(':memory:')
      expect(columns(db)).toEqual(expect.arrayContaining(['favorite', 'tags', 'series', 'volume']))
      expect(db.pragma('user_version', { simple: true })).toBe(1)
    })

    it('列を追加する前の既存DBを開くと、データを残したまま列が追加される', () => {
      dir = mkdtempSync(join(tmpdir(), 'reading-app-'))
      const path = join(dir, 'old.db')
      // マイグレーション導入前の構造（user_version = 0）
      const old = new Database(path)
      old.exec(`CREATE TABLE books (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, authors TEXT, isbn TEXT UNIQUE,
        pages INTEGER, cover TEXT, genre TEXT,
        status TEXT NOT NULL CHECK (status IN ('want', 'reading', 'done')),
        current_page INTEGER, rating INTEGER CHECK (rating BETWEEN 0 AND 5), review TEXT,
        added_at TEXT, finished_at TEXT)`)
      old.prepare("INSERT INTO books (id, title, status) VALUES (1, '吾輩は猫である', 'want')").run()
      old.close()

      const db = openDb(path)
      expect(columns(db)).toEqual(expect.arrayContaining(['favorite', 'tags', 'series', 'volume']))
      expect(db.prepare('SELECT title, favorite, tags, series, volume FROM books WHERE id = 1').get()).toEqual({
        title: '吾輩は猫である',
        favorite: 0,
        tags: null,
        series: null,
        volume: null,
      })
      db.close()

      // 開き直しても、同じマイグレーションを二重に適用しない
      const reopened = openDb(path)
      expect(reopened.pragma('user_version', { simple: true })).toBe(1)
      reopened.close()
    })
  })
})
