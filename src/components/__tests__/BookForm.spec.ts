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

  it('シリーズ・巻数・タグを入力すると、その値も渡す（タグは区切って重複をまとめる）', async () => {
    const wrapper = mountForm()
    await fieldByLabel(wrapper, 'タイトル').setValue('ONE PIECE 1')
    await fieldByLabel(wrapper, 'シリーズ').setValue(' ONE PIECE ')
    await fieldByLabel(wrapper, '巻数').setValue('1')
    await fieldByLabel(wrapper, 'タグ').setValue('漫画、冒険, 漫画')
    await wrapper.find('form').trigger('submit')

    expect(submitted(wrapper)![0]![0]).toEqual({
      title: 'ONE PIECE 1',
      status: 'want',
      series: 'ONE PIECE',
      volume: 1,
      tags: ['漫画', '冒険'],
    })
  })

  it.each([['0'], ['1.5']])('巻数が %s なら送信しない', async (volume) => {
    const wrapper = mountForm()
    await fieldByLabel(wrapper, 'タイトル').setValue('a')
    await fieldByLabel(wrapper, '巻数').setValue(volume)
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)).toBeUndefined()
    expect(wrapper.find('[role="alert"]').text()).toContain('巻数')
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

describe('BookForm の自動入力（prefill）', () => {
  const candidate = {
    title: 'リーダブルコード',
    authors: ['Dustin Boswell', 'Trevor Foucher'],
    isbn: '9784873115658',
    pages: 260,
    genre: 'Computers',
    cover: 'https://example.com/c.jpg',
  }

  it('候補を渡すと書誌に関する項目が入力される', async () => {
    const wrapper = mountForm()
    await wrapper.setProps({ prefill: candidate })

    expect((fieldByLabel(wrapper, 'タイトル').element as HTMLInputElement).value).toBe('リーダブルコード')
    expect((fieldByLabel(wrapper, '著者').element as HTMLInputElement).value).toBe('Dustin Boswell、Trevor Foucher')
    expect((fieldByLabel(wrapper, 'ISBN').element as HTMLInputElement).value).toBe('9784873115658')

    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).toEqual({ ...candidate, status: 'want' })
  })

  it('入力後も編集できる', async () => {
    const wrapper = mountForm()
    await wrapper.setProps({ prefill: candidate })
    await fieldByLabel(wrapper, 'タイトル').setValue('リーダブルコード 第2版')
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).toMatchObject({ title: 'リーダブルコード 第2版' })
  })

  it('別の候補を選ぶと、前の候補の値は残らない', async () => {
    const wrapper = mountForm()
    await wrapper.setProps({ prefill: candidate })
    await wrapper.setProps({ prefill: { title: '別の本' } })
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).toEqual({ title: '別の本', status: 'want' })
  })

  it('状態と現在のページは変更しない', async () => {
    const wrapper = mountForm()
    await fieldByLabel(wrapper, '状態').setValue('reading')
    await fieldByLabel(wrapper, '現在のページ').setValue('30')
    await wrapper.setProps({ prefill: candidate })
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).toMatchObject({ status: 'reading', current_page: 30 })
  })

  it('入力エラーの表示は自動入力でクリアされる', async () => {
    const wrapper = mountForm()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    await wrapper.setProps({ prefill: candidate })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})

describe('BookForm の編集（initial / clearEmpty）', () => {
  const book = {
    title: '吾輩は猫である',
    authors: ['夏目漱石', '別の著者'],
    isbn: '9784873115658',
    pages: 200,
    cover: 'https://example.com/c.jpg',
    genre: '小説',
    status: 'reading' as const,
    current_page: 50,
    tags: ['名作', '猫'],
    series: '漱石全集',
    volume: 1,
  }

  const value = (wrapper: ReturnType<typeof mountForm>, label: string) =>
    (fieldByLabel(wrapper, label).element as HTMLInputElement).value

  it('渡した本の内容が最初の入力値になる', () => {
    const wrapper = mountForm({ initial: book })
    expect(value(wrapper, 'タイトル')).toBe('吾輩は猫である')
    expect(value(wrapper, '著者')).toBe('夏目漱石、別の著者')
    expect(value(wrapper, 'ISBN')).toBe('9784873115658')
    expect(value(wrapper, '総ページ数')).toBe('200')
    expect(value(wrapper, 'ジャンル')).toBe('小説')
    expect(value(wrapper, '表紙画像のURL')).toBe('https://example.com/c.jpg')
    expect(value(wrapper, '状態')).toBe('reading')
    expect(value(wrapper, '現在のページ')).toBe('50')
  })

  it('編集では、シリーズ・巻数・タグの現在の値が入力されている', () => {
    const wrapper = mountForm({ initial: book })
    expect(value(wrapper, 'シリーズ')).toBe('漱石全集')
    expect(value(wrapper, '巻数')).toBe('1')
    expect(value(wrapper, 'タグ')).toBe('名作、猫')
  })

  it('変更しないで送ると、元の内容がそのまま送られる', async () => {
    const wrapper = mountForm({ initial: book, clearEmpty: true })
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).toEqual({
      title: '吾輩は猫である',
      authors: ['夏目漱石', '別の著者'],
      isbn: '9784873115658',
      pages: 200,
      cover: 'https://example.com/c.jpg',
      genre: '小説',
      series: '漱石全集',
      volume: 1,
      tags: ['名作', '猫'],
      status: 'reading',
      current_page: 50,
    })
  })

  it('clearEmpty のとき、空にした項目は null で送って値を消す', async () => {
    const wrapper = mountForm({ initial: book, clearEmpty: true })
    await fieldByLabel(wrapper, '著者').setValue('')
    await fieldByLabel(wrapper, 'ISBN').setValue('  ')
    await fieldByLabel(wrapper, '総ページ数').setValue('')
    await fieldByLabel(wrapper, 'ジャンル').setValue('')
    await fieldByLabel(wrapper, '表紙画像のURL').setValue('')
    await fieldByLabel(wrapper, '現在のページ').setValue('')
    await fieldByLabel(wrapper, 'シリーズ').setValue('')
    await fieldByLabel(wrapper, '巻数').setValue('')
    await fieldByLabel(wrapper, 'タグ').setValue('')
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).toEqual({
      title: '吾輩は猫である',
      authors: null,
      isbn: null,
      pages: null,
      cover: null,
      genre: null,
      series: null,
      volume: null,
      tags: null,
      status: 'reading',
      current_page: null,
    })
  })

  it('clearEmpty でも、読書中以外では現在のページを送らない（変更しない）', async () => {
    const wrapper = mountForm({ initial: book, clearEmpty: true })
    await fieldByLabel(wrapper, '状態').setValue('done')
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).not.toHaveProperty('current_page')
  })

  it('clearEmpty でなければ、空の項目は送らない', async () => {
    const wrapper = mountForm({ initial: { ...book, genre: null } })
    await wrapper.find('form').trigger('submit')
    expect(submitted(wrapper)![0]![0]).not.toHaveProperty('genre')
  })

  it('cancelLabel があればキャンセルボタンを表示し、押すと cancel を通知する', async () => {
    const wrapper = mountForm({ cancelLabel: 'キャンセル' })
    const cancel = wrapper.findAll('button').find((b) => b.text() === 'キャンセル')!
    await cancel.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(submitted(wrapper)).toBeUndefined()
  })

  it('cancelLabel がなければキャンセルボタンを表示しない', () => {
    expect(mountForm().findAll('button')).toHaveLength(1)
  })
})
