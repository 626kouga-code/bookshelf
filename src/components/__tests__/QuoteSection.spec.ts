import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Quote } from '@/api/books'
import QuoteSection from '../QuoteSection.vue'

type Props = { quotes: Quote[]; disabled?: boolean; loading?: boolean }

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  id: 1,
  book_id: 7,
  text: '吾輩は猫である',
  page: 1,
  ...overrides,
})

const mountSection = (props: Props) => mount(QuoteSection, { props })

describe('QuoteSection', () => {
  it('引用がなければ「まだ引用がありません」と表示する', () => {
    const wrapper = mountSection({ quotes: [] })
    expect(wrapper.text()).toContain('まだ引用がありません')
  })

  it('引用を一覧表示する（ページ番号があれば表示する）', () => {
    const wrapper = mountSection({
      quotes: [quote({ id: 1, text: '一つ目', page: 5 }), quote({ id: 2, text: '二つ目', page: null })],
    })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('一つ目')
    expect(items[0]!.text()).toContain('p.5')
    expect(items[1]!.text()).toContain('二つ目')
    expect(items[1]!.text()).not.toContain('p.')
  })

  it('文章とページ番号を入力して追加できる', async () => {
    const wrapper = mountSection({ quotes: [] })
    await wrapper.find('textarea').setValue('  名前はまだ無い  ')
    await wrapper.find('input[type="number"]').setValue('12')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('add')![0]).toEqual([{ text: '名前はまだ無い', page: 12 }])
  })

  it('ページ番号は省略できる', async () => {
    const wrapper = mountSection({ quotes: [] })
    await wrapper.find('textarea').setValue('猫である')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('add')![0]).toEqual([{ text: '猫である', page: null }])
  })

  it('空文字の引用はエラーにして通知しない', async () => {
    const wrapper = mountSection({ quotes: [] })
    await wrapper.find('textarea').setValue('   ')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('add')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('文章を入力してください')
  })

  it('不正なページ番号はエラーにして通知しない', async () => {
    const wrapper = mountSection({ quotes: [] })
    await wrapper.find('textarea').setValue('猫である')
    await wrapper.find('input[type="number"]').setValue('0')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('add')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('1以上の整数')
  })

  it('削除ボタンで引用IDを通知する', async () => {
    const wrapper = mountSection({ quotes: [quote({ id: 42 })] })
    await wrapper.find('button.text-red-700').trigger('click')
    expect(wrapper.emitted('delete')![0]).toEqual([42])
  })

  it('読み込み中は一覧の代わりに読み込み中と表示する', () => {
    const wrapper = mountSection({ quotes: [], loading: true })
    expect(wrapper.text()).toContain('読み込み中')
    expect(wrapper.text()).not.toContain('まだ引用がありません')
  })

  it('無効のときは入力・追加・削除ができない', () => {
    const wrapper = mountSection({ quotes: [quote()], disabled: true })
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button.text-red-700').attributes('disabled')).toBeDefined()
  })
})
