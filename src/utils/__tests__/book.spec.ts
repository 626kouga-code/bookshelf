import { describe, expect, it } from 'vitest'
import { daysSince, formatDate, progressOf, STATUS_OPTIONS } from '../book'

describe('progressOf', () => {
  it('現在のページと総ページ数から割合を計算する', () => {
    expect(progressOf({ pages: 200, current_page: 50 })).toEqual({ current: 50, pages: 200, percent: 25 })
  })

  it('割合は四捨五入し、100%を超えない', () => {
    expect(progressOf({ pages: 3, current_page: 1 })!.percent).toBe(33)
    expect(progressOf({ pages: 100, current_page: 500 })!.percent).toBe(100)
  })

  it('現在のページが0でも進捗として扱う', () => {
    expect(progressOf({ pages: 100, current_page: 0 })!.percent).toBe(0)
  })

  it('総ページ数か現在のページが未入力なら null', () => {
    expect(progressOf({ pages: null, current_page: 10 })).toBeNull()
    expect(progressOf({ pages: 100, current_page: null })).toBeNull()
  })
})

describe('daysSince', () => {
  // ローカル時刻で日時を作り、実行環境のタイムゾーンに左右されないようにする
  const now = new Date(2026, 8, 26, 9, 0)

  it('登録日から今日までの日数を返す', () => {
    expect(daysSince(new Date(2026, 8, 16, 12, 0).toISOString(), now)).toBe(10)
  })

  it('時刻ではなく日付で数える（前日の夜遅くの登録でも1日）', () => {
    expect(daysSince(new Date(2026, 8, 25, 23, 59).toISOString(), now)).toBe(1)
  })

  it('当日の登録は0日', () => {
    expect(daysSince(new Date(2026, 8, 26, 0, 1).toISOString(), now)).toBe(0)
  })

  it('年をまたいでも数えられる', () => {
    expect(daysSince(new Date(2025, 8, 26, 12, 0).toISOString(), now)).toBe(365)
  })

  it('不正な値・未来の日時は null', () => {
    expect(daysSince('not a date', now)).toBeNull()
    expect(daysSince(new Date(2026, 8, 27, 12, 0).toISOString(), now)).toBeNull()
  })
})

describe('formatDate', () => {
  it('ISO 8601 の日時を日本語形式の日付にする', () => {
    // 正午UTCなら、日本を含むほぼ全てのタイムゾーンで同じ日付になる
    expect(formatDate('2026-09-21T12:00:00.000Z')).toBe('2026/9/21')
  })

  it('空・不正な値は空文字', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
    expect(formatDate('not a date')).toBe('')
  })
})

describe('STATUS_OPTIONS', () => {
  it('読みたい・読書中・読了の順に並ぶ', () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual(['want', 'reading', 'done'])
    expect(STATUS_OPTIONS.map((o) => o.label)).toEqual(['読みたい', '読書中', '読了'])
  })
})
