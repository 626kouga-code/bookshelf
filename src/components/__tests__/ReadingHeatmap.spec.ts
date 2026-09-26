import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { DailyPages } from '@/api/stats'
import ReadingHeatmap from '../ReadingHeatmap.vue'

// 2026-09-26 は土曜日（週の最終行）。ローカル時刻で作り、タイムゾーンに左右されないようにする
const today = new Date(2026, 8, 26, 9, 0)

const render = (days: DailyPages[] = [], base: Date = today) => mount(ReadingHeatmap, { props: { days, today: base } })
const cell = (wrapper: ReturnType<typeof render>, date: string) => wrapper.find(`rect[data-date="${date}"]`)
const dayCells = (wrapper: ReturnType<typeof render>) => wrapper.findAll('rect[data-date]')

describe('ReadingHeatmap', () => {
  it('53週分のマスを、日曜始まりで今日まで描く', () => {
    const wrapper = render()
    const cells = dayCells(wrapper)
    expect(cells).toHaveLength(53 * 7)
    // 左上は52週前の日曜、右下が今日
    expect(cells[0]!.attributes('data-date')).toBe('2025-09-21')
    expect(cells[cells.length - 1]!.attributes('data-date')).toBe('2026-09-26')
  })

  it('週の途中なら、今日より後の日は描かない', () => {
    // 2026-09-23 は水曜日。最後の列は日〜水の4マス
    const cells = dayCells(render([], new Date(2026, 8, 23, 9, 0)))
    expect(cells).toHaveLength(52 * 7 + 4)
    expect(cells[cells.length - 1]!.attributes('data-date')).toBe('2026-09-23')
  })

  it('ページ数に応じて色の濃さを4段階で変え、記録のない日は0', () => {
    const wrapper = render([
      { date: '2026-09-20', pages: 100 },
      { date: '2026-09-21', pages: 60 },
      { date: '2026-09-22', pages: 30 },
      { date: '2026-09-23', pages: 1 },
    ])
    expect(cell(wrapper, '2026-09-20').attributes('data-level')).toBe('4')
    expect(cell(wrapper, '2026-09-21').attributes('data-level')).toBe('3')
    expect(cell(wrapper, '2026-09-22').attributes('data-level')).toBe('2')
    expect(cell(wrapper, '2026-09-23').attributes('data-level')).toBe('1')
    expect(cell(wrapper, '2026-09-24').attributes('data-level')).toBe('0')
  })

  it('各マスに日付とページ数のツールチップを付ける', () => {
    const wrapper = render([{ date: '2026-09-20', pages: 42 }])
    expect(cell(wrapper, '2026-09-20').find('title').text()).toBe('2026/9/20: 42ページ')
    expect(cell(wrapper, '2026-09-21').find('title').text()).toBe('2026/9/21: 記録なし')
  })

  it('期間内の読書日数と合計ページ数を表示する', () => {
    const wrapper = render([
      { date: '2026-09-20', pages: 40 },
      { date: '2026-09-25', pages: 1000 },
      // 表示期間より前の日は数えない
      { date: '2025-01-01', pages: 99 },
    ])
    expect(wrapper.text()).toContain('直近1年で 2日・1,040ページ読書')
  })

  it('月が変わる週の上に月ラベルを出す', () => {
    const text = render().findAll('text').map((t) => t.text())
    expect(text).toContain('9月')
    expect(text).toContain('1月')
    expect(text).toContain('月')
  })
})
