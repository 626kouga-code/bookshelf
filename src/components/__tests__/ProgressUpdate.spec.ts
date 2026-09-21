import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressUpdate from '../ProgressUpdate.vue'

type Props = { currentPage: number | null; pages: number | null; disabled?: boolean }

const mountProgress = (props: Props) => mount(ProgressUpdate, { props })

const input = (wrapper: ReturnType<typeof mountProgress>) => wrapper.find('input[type="number"]')
const value = (wrapper: ReturnType<typeof mountProgress>) => (input(wrapper).element as HTMLInputElement).value
const emitted = (wrapper: ReturnType<typeof mountProgress>) => wrapper.emitted('update') as number[][] | undefined

describe('ProgressUpdate', () => {
  it('現在のページと総ページ数を表示する', () => {
    const wrapper = mountProgress({ currentPage: 50, pages: 200 })
    expect(value(wrapper)).toBe('50')
    expect(wrapper.text()).toContain('/ 200')
  })

  it('未入力なら空欄で、総ページ数がなければ「/」を表示しない', () => {
    const wrapper = mountProgress({ currentPage: null, pages: null })
    expect(value(wrapper)).toBe('')
    expect(wrapper.text()).not.toContain('/')
  })

  it('入力したページを通知する', async () => {
    const wrapper = mountProgress({ currentPage: 50, pages: 200 })
    await input(wrapper).setValue('120')
    await wrapper.find('form').trigger('submit')
    expect(emitted(wrapper)![0]).toEqual([120])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('0ページも入力できる', async () => {
    const wrapper = mountProgress({ currentPage: 50, pages: 200 })
    await input(wrapper).setValue('0')
    await wrapper.find('form').trigger('submit')
    expect(emitted(wrapper)![0]).toEqual([0])
  })

  it('総ページ数ちょうどまで入力できる', async () => {
    const wrapper = mountProgress({ currentPage: 50, pages: 200 })
    await input(wrapper).setValue('200')
    await wrapper.find('form').trigger('submit')
    expect(emitted(wrapper)![0]).toEqual([200])
  })

  it('総ページ数を超える値はエラーにして通知しない', async () => {
    const wrapper = mountProgress({ currentPage: 50, pages: 200 })
    await input(wrapper).setValue('201')
    await wrapper.find('form').trigger('submit')
    expect(emitted(wrapper)).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('総ページ数（200）を超えています')
  })

  it('総ページ数が不明なら上限なしで入力できる', async () => {
    const wrapper = mountProgress({ currentPage: null, pages: null })
    await input(wrapper).setValue('9999')
    await wrapper.find('form').trigger('submit')
    expect(emitted(wrapper)![0]).toEqual([9999])
  })

  it.each([['-1'], ['1.5'], ['']])('「%s」はエラーにして通知しない', async (text) => {
    const wrapper = mountProgress({ currentPage: 50, pages: 200 })
    await input(wrapper).setValue(text)
    await wrapper.find('form').trigger('submit')
    expect(emitted(wrapper)).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('0以上の整数')
  })

  it('外から現在のページが変わったら入力欄とエラーを合わせる', async () => {
    const wrapper = mountProgress({ currentPage: 50, pages: 200 })
    await input(wrapper).setValue('999')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await wrapper.setProps({ currentPage: 80 })
    expect(value(wrapper)).toBe('80')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('無効のときは入力も更新もできない', () => {
    const wrapper = mountProgress({ currentPage: 50, pages: 200, disabled: true })
    expect(input(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
