import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BookForm from '../BookForm.vue'

type Emitted = Record<string, unknown>[][]

const mountForm = (props: Record<string, unknown> = {}) => mount(BookForm, { props })

const fieldByLabel = (wrapper: ReturnType<typeof mountForm>, label: string) =>
  wrapper.findAll('label').find((l) => l.text().startsWith(label))!.find('input, select')

const submitted = (wrapper: ReturnType<typeof mountForm>) => wrapper.emitted('submit') as Emitted | undefined

describe('BookForm', () => {
  it('タイトルだけで送信でき、状態は既定で「読みたい」', async () => {
    const wrapper = mountForm()
    await fieldByLabel(wrapper, 'タイトル').setValue('  吾輩は猫である ')
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).toEqual({ title: '吾輩は猫である', status: 'want' })
  })

  it('全項目を入力して送信すると、型を整えて渡す', async () => {
    const wrapper = mountForm()
    await fieldByLabel(wrapper, 'タイトル').setValue('SICP')
    await fieldByLabel(wrapper, '著者').setValue('Abelson、 Sussman, ,')
    await fieldByLabel(wrapper, 'ISBN').setValue(' 978-0-306-40615-7 ')
    await fieldByLabel(wrapper, '総ページ数').setValue('657')
    await fieldByLabel(wrapper, 'ジャンル').setValue('技術書')
    await fieldByLabel(wrapper, '表紙画像のURL').setValue('https://example.com/c.jpg')
    await fieldByLabel(wrapper, '状態').setValue('reading')
    await fieldByLabel(wrapper, '現在のページ').setValue('10')
    await wrapper.find('form').trigger('submit')

    expect(submitted(wrapper)![0]![0]).toEqual({
      title: 'SICP',
      authors: ['Abelson', 'Sussman'],
      isbn: '978-0-306-40615-7',
      pages: 657,
      cover: 'https://example.com/c.jpg',
      genre: '技術書',
      status: 'reading',
      current_page: 10,
    })
  })

  it('タイトルが空白なら送信せずエラーを表示する', async () => {
    const wrapper = mountForm()
    await fieldByLabel(wrapper, 'タイトル').setValue('   ')
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('タイトルを入力してください')
  })

  it.each([['0'], ['-3'], ['1.5']])('総ページ数が %s なら送信しない', async (pages) => {
    const wrapper = mountForm()
    await fieldByLabel(wrapper, 'タイトル').setValue('a')
    await fieldByLabel(wrapper, '総ページ数').setValue(pages)
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('総ページ数')
  })

  it('「現在のページ」は読書中のときだけ表示し、他の状態では送らない', async () => {
    const wrapper = mountForm()
    const hasCurrentPage = () => wrapper.findAll('label').some((l) => l.text().startsWith('現在のページ'))
    expect(hasCurrentPage()).toBe(false)

    await fieldByLabel(wrapper, '状態').setValue('reading')
    expect(hasCurrentPage()).toBe(true)
    await fieldByLabel(wrapper, '現在のページ').setValue('30')

    await fieldByLabel(wrapper, '状態').setValue('done')
    expect(hasCurrentPage()).toBe(false)
    await fieldByLabel(wrapper, 'タイトル').setValue('a')
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).toEqual({ title: 'a', status: 'done' })
  })

  it('読書中で現在のページが負なら送信しない', async () => {
    const wrapper = mountForm()
    await fieldByLabel(wrapper, 'タイトル').setValue('a')
    await fieldByLabel(wrapper, '状態').setValue('reading')
    await fieldByLabel(wrapper, '現在のページ').setValue('-1')
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)).toBeUndefined()
  })

  it('サーバーのエラーを表示する', () => {
    const wrapper = mountForm({ error: '同じISBNの本が既に登録されています' })
    expect(wrapper.find('[role="alert"]').text()).toContain('同じISBNの本が既に登録されています')
  })

  it('送信中はボタンを無効にする', () => {
    const wrapper = mountForm({ submitting: true })
    const button = wrapper.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('送信中…')
  })
})
