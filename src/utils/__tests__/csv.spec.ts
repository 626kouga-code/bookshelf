import { describe, expect, it } from 'vitest'
import type { Book } from '@/api/books'
import { booksToCsv, csvCell, toCsv } from '../csv'

const book: Book = {
  id: 1,
  title: '三体',
  authors: ['劉慈欣', '大森望'],
  isbn: '9784152098702',
  pages: 448,
  cover: 'https://example.com/c.jpg',
  genre: 'SF',
  status: 'done',
  current_page: 448,
  rating: 5,
  review: '面白かった',
  // 正午（UTC）なら、日本を含むほぼ全てのタイムゾーンで同じ日付になる
  added_at: '2026-01-10T12:00:00.000Z',
  finished_at: '2026-02-01T12:00:00.000Z',
  favorite: true,
  tags: ['SF', '名作'],
  series: '三体',
  volume: 1,
}

/** BOMを除き、行ごとに分ける。 */
const lines = (csv: string) => csv.replace(/^﻿/, '').split('\r\n')

describe('csvCell', () => {
  it('ふつうの値はそのまま、null は空', () => {
    expect(csvCell('三体')).toBe('三体')
    expect(csvCell(448)).toBe('448')
    expect(csvCell(null)).toBe('')
  })

  it('カンマ・改行を含む値はダブルクォートで囲み、ダブルクォートは2つに重ねる', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('1行目\n2行目')).toBe('"1行目\n2行目"')
    expect(csvCell('「"引用"」')).toBe('"「""引用""」"')
  })

  it.each([['=SUM(A1)'], ['+1'], ['-1'], ['@cmd']])('数式になりうる %s は先頭に \' を付ける', (value) => {
    expect(csvCell(value)).toBe(`'${value}`)
  })

  it('数値の列は数式対策の対象外', () => {
    expect(csvCell(-1)).toBe('-1')
  })
})

describe('toCsv', () => {
  it('BOM付きで、行をCRLFでつなぐ', () => {
    expect(toCsv([['a', 'b'], ['c', null]])).toBe('﻿a,b\r\nc,\r\n')
  })
})

describe('booksToCsv', () => {
  it('1行目は日本語の見出し', () => {
    expect(lines(booksToCsv([]))[0]).toBe(
      'タイトル,著者,ISBN,総ページ数,ジャンル,シリーズ,巻数,タグ,状態,現在のページ,評価,お気に入り,登録日,読了日,感想',
    )
  })

  it('本1冊を1行にする（著者・タグは「、」区切り、状態は日本語、日付は YYYY-MM-DD）', () => {
    expect(lines(booksToCsv([book]))[1]).toBe(
      '三体,劉慈欣、大森望,9784152098702,448,SF,三体,1,SF、名作,読了,448,5,★,2026-01-10,2026-02-01,面白かった',
    )
  })

  it('未入力の項目は空にする（未評価・お気に入りでない場合も空）', () => {
    const empty: Book = {
      ...book,
      authors: [],
      isbn: null,
      pages: null,
      genre: null,
      series: null,
      volume: null,
      tags: [],
      status: 'want',
      current_page: null,
      rating: 0,
      favorite: false,
      finished_at: null,
      review: null,
    }
    expect(lines(booksToCsv([empty]))[1]).toBe('三体,,,,,,,,読みたい,,,,2026-01-10,,')
  })

  it('感想に改行やカンマがあっても1つのセルに収まる', () => {
    const csv = booksToCsv([{ ...book, review: '前半は退屈,\n後半は"最高"' }])
    expect(csv).toContain(',"前半は退屈,\n後半は""最高"""\r\n')
  })
})
