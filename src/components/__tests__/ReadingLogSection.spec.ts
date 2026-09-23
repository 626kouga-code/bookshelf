import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Prediction, ReadingLog } from '@/api/books'
import ReadingLogSection from '../ReadingLogSection.vue'

type Props = {
  logs: ReadingLog[]
  prediction: Prediction | null
  readOnly?: boolean
  disabled?: boolean
  loading?: boolean
}

const log = (overrides: Partial<ReadingLog> = {}): ReadingLog => ({
  id: 1,
  book_id: 7,
  date: '2026-09-20',
  pages: 30,
  ...overrides,
})

const mountSection = (props: Props) => mount(ReadingLogSection, { props })

describe('ReadingLogSection', () => {
  it('ログがなければ「まだ記録がありません」と表示する', () => {
    const wrapper = mountSection({ logs: [], prediction: null })
    expect(wrapper.text()).toContain('まだ記録がありません')
  })

  it('ログを一覧表示する', () => {
    const wrapper = mountSection({
      logs: [log({ id: 1, date: '2026-09-20', pages: 30 }), log({ id: 2, date: '2026-09-19', pages: 10 })],
      prediction: null,
    })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('2026-09-20（30ページ）')
    expect(items[1]!.text()).toContain('2026-09-19（10ページ）')
  })

  it('日付とページ数を入力して記録できる', async () => {
    const wrapper = mountSection({ logs: [], prediction: null })
    await wrapper.find('input[type="date"]').setValue('2026-09-21')
    await wrapper.find('input[type="number"]').setValue('25')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('add')![0]).toEqual([{ date: '2026-09-21', pages: 25 }])
  })

  it('不正なページ数はエラーにして通知しない', async () => {
    const wrapper = mountSection({ logs: [], prediction: null })
    await wrapper.find('input[type="number"]').setValue('0')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('add')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('1以上の整数')
  })

  it('削除ボタンでログIDを通知する', async () => {
    const wrapper = mountSection({ logs: [log({ id: 42 })], prediction: null })
    await wrapper.find('button.text-red-700').trigger('click')
    expect(wrapper.emitted('delete')![0]).toEqual([42])
  })

  it('算出できた読了予測を表示する', () => {
    const wrapper = mountSection({
      logs: [],
      prediction: { available: true, remainingPages: 160, pagesPerDay: 10, estimatedDays: 16 },
    })
    expect(wrapper.text()).toContain('あと約16日で読み終わりそうです')
    expect(wrapper.text()).toContain('1日あたり10ページ')
  })

  it('算出できない読了予測は理由を表示する', () => {
    const wrapper = mountSection({
      logs: [],
      prediction: { available: false, reason: '直近の読書ログがありません' },
    })
    expect(wrapper.text()).toContain('直近の読書ログがありません')
  })

  it('読み込み中は一覧の代わりに読み込み中と表示する', () => {
    const wrapper = mountSection({ logs: [], prediction: null, loading: true })
    expect(wrapper.text()).toContain('読み込み中')
    expect(wrapper.text()).not.toContain('まだ記録がありません')
  })

  it('読み取り専用のときは記録フォーム・予測・削除ボタンを出さない', () => {
    const wrapper = mountSection({
      logs: [log()],
      prediction: { available: true, remainingPages: 0, pagesPerDay: 10, estimatedDays: 0 },
      readOnly: true,
    })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('あと約')
    expect(wrapper.find('button.text-red-700').exists()).toBe(false)
    // 履歴自体は表示する
    expect(wrapper.text()).toContain('2026-09-20（30ページ）')
  })

  it('無効のときは入力・記録・削除ができない', () => {
    const wrapper = mountSection({ logs: [log()], prediction: null, disabled: true })
    expect(wrapper.find('input[type="date"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button.text-red-700').attributes('disabled')).toBeDefined()
  })
})
