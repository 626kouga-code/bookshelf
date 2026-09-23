import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Goal, Stats } from '@/api/stats'
import StatsView from '../StatsView.vue'

// StatsView は import 時点の日付から「今年・今月」を計算するため、
// テストも同じ基準（実行時の現在日時）で期待値を作る。
const now = new Date()
const currentYear = String(now.getFullYear())
const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`

function makeStats(overrides: Partial<Stats> = {}): Stats {
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, count: 0 }
  })
  return {
    monthly_finished: months,
    genre_counts: [],
    total_pages_read: 0,
    current_streak_days: 0,
    ...overrides,
  }
}

function makeGoal(periodType: 'year' | 'month', period: string, overrides: Partial<Goal> = {}): Goal {
  return { period_type: periodType, period, target_books: null, target_daily_pages: null, ...overrides }
}

function stubFetch(handler: (url: URL) => Response | Promise<Response>) {
  const fn = vi.fn<typeof fetch>(async (input) => handler(new URL(String(input), 'http://localhost')))
  vi.stubGlobal('fetch', fn)
  return fn
}

async function mountView() {
  const wrapper = mount(StatsView)
  await flushPromises()
  return wrapper
}

describe('StatsView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('統計を表示する', async () => {
    stubFetch((url) => {
      if (url.pathname === '/api/stats') {
        return Response.json(
          makeStats({
            genre_counts: [{ genre: '小説', count: 3 }, { genre: null, count: 1 }],
            total_pages_read: 1234,
            current_streak_days: 5,
          }),
        )
      }
      const periodType = url.searchParams.get('period_type')
      return Response.json(makeGoal(periodType === 'year' ? 'year' : 'month', url.searchParams.get('period')!))
    })
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('1,234')
    expect(wrapper.text()).toContain('5日')
    expect(wrapper.text()).toContain('未設定')
    expect(wrapper.findAll('rect').length).toBeGreaterThan(0)
  })

  it('当月の読了数を月間目標に対する達成度として表示する', async () => {
    stubFetch((url) => {
      if (url.pathname === '/api/stats') {
        const stats = makeStats()
        stats.monthly_finished[stats.monthly_finished.length - 1] = { month: currentMonth, count: 2 }
        return Response.json(stats)
      }
      if (url.searchParams.get('period_type') === 'month') {
        return Response.json(makeGoal('month', currentMonth, { target_books: 4, target_daily_pages: 20 }))
      }
      return Response.json(makeGoal('year', currentYear))
    })
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('2 / 4冊（50%）')
  })

  it('目標を保存すると PUT で送る', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.pathname === '/api/stats') return Response.json(makeStats())
      const periodType = url.searchParams.get('period_type') as 'year' | 'month'
      return Response.json(makeGoal(periodType, url.searchParams.get('period')!))
    })
    const wrapper = await mountView()

    const yearForm = wrapper.findAll('form')[0]!
    await yearForm.find('input[type="number"]').setValue('24')
    await yearForm.trigger('submit')
    await flushPromises()

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(String(putCall[0])).toContain(`period_type=year&period=${currentYear}`)
    expect(JSON.parse(String(putCall[1]?.body))).toEqual({ target_books: 24 })
  })

  it('取得に失敗したらエラーを表示し、再読み込みで復旧できる', async () => {
    let fail = true
    stubFetch(() => (fail ? Response.json({ error: '統計エラー' }, { status: 500 }) : Response.json(makeStats())))
    const wrapper = await mountView()
    expect(wrapper.find('[role="alert"]').text()).toContain('統計エラー')

    fail = false
    await wrapper.find('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
