import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GoalForm from '../GoalForm.vue'

describe('GoalForm', () => {
  it('現在の目標冊数を表示する', () => {
    const wrapper = mount(GoalForm, { props: { title: '年間目標', targetBooks: 24 } })
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('24')
  })

  it('targetDailyPages が undefined ならその入力欄を出さない', () => {
    const wrapper = mount(GoalForm, { props: { title: '年間目標', targetBooks: null } })
    expect(wrapper.findAll('input[type="number"]')).toHaveLength(1)
  })

  it('targetDailyPages を指定すると1日あたりの目標ページ数欄も出す', () => {
    const wrapper = mount(GoalForm, { props: { title: '月間目標', targetBooks: 2, targetDailyPages: 20 } })
    const inputs = wrapper.findAll('input[type="number"]')
    expect(inputs).toHaveLength(2)
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('20')
  })

  it('入力して保存すると通知する', async () => {
    const wrapper = mount(GoalForm, { props: { title: '月間目標', targetBooks: null, targetDailyPages: null } })
    const inputs = wrapper.findAll('input[type="number"]')
    await inputs[0]!.setValue('3')
    await inputs[1]!.setValue('15')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')![0]).toEqual([{ target_books: 3, target_daily_pages: 15 }])
  })

  it('空にして保存すると null を通知する（未設定に戻す）', async () => {
    const wrapper = mount(GoalForm, { props: { title: '年間目標', targetBooks: 24 } })
    await wrapper.find('input[type="number"]').setValue('')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')![0]).toEqual([{ target_books: null }])
  })

  it('不正な値はエラーにして通知しない', async () => {
    const wrapper = mount(GoalForm, { props: { title: '年間目標', targetBooks: null } })
    await wrapper.find('input[type="number"]').setValue('0')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('1以上の整数')
  })

  it('達成度が渡されれば表示する', () => {
    const wrapper = mount(GoalForm, {
      props: { title: '年間目標', targetBooks: 24, achievement: '12 / 24冊（50%）' },
    })
    expect(wrapper.text()).toContain('12 / 24冊（50%）')
  })

  it('無効のときは入力・保存ができない', () => {
    const wrapper = mount(GoalForm, { props: { title: '年間目標', targetBooks: 24, disabled: true } })
    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('外から目標が変わったら入力欄も合わせる', async () => {
    const wrapper = mount(GoalForm, { props: { title: '年間目標', targetBooks: 24 } })
    await wrapper.setProps({ targetBooks: 30 })
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('30')
  })
})
