import { describe, expect, it } from 'vitest'
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
})
