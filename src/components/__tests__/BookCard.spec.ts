import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Book } from '@/api/books'
import BookCard from '../BookCard.vue'

const base: Book = {
  id: 1,
  title: '吾輩は猫である',
  authors: ['夏目漱石', '別の著者'],
  isbn: null,
  pages: 200,
  cover: null,
  genre: '小説',
  status: 'reading',
  current_page: 50,
  rating: 4,
  review: null,
  added_at: '2026-01-01T00:00:00.000Z',
  finished_at: null,
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/books/:id', component: { template: '<div />' } }],
})

const render = (book: Partial<Book> = {}) =>
  mount(BookCard, { props: { book: { ...base, ...book } }, global: { plugins: [router] } })

describe('BookCard', () => {
  it('タイトル・著者・状態・ジャンルを表示する', () => {
    const text = render().text()
    expect(text).toContain('吾輩は猫である')
    expect(text).toContain('夏目漱石、別の著者')
    expect(text).toContain('読書中')
    expect(text).toContain('小説')
  })

  it('読書中は進捗（ページ数と割合）を表示する', () => {
    expect(render().text()).toContain('50 / 200 ページ（25%）')
  })

  it('読書中でなければ進捗を表示しない', () => {
    expect(render({ status: 'done' }).text()).not.toContain('ページ（')
  })

  it('進捗は100%を超えない', () => {
    expect(render({ current_page: 500 }).text()).toContain('（100%）')
  })

  it('総ページ数がなければ進捗を表示しない', () => {
    expect(render({ pages: null }).text()).not.toContain('ページ（')
  })

  it('読みたいの本は登録日からの積読日数を表示する', () => {
    const added = new Date()
    added.setDate(added.getDate() - 3)
    expect(render({ status: 'want', added_at: added.toISOString() }).text()).toContain('積読 3日')
  })

  it('読みたい以外の本には積読日数を表示しない', () => {
    expect(render({ status: 'reading' }).text()).not.toContain('積読')
    expect(render({ status: 'done' }).text()).not.toContain('積読')
  })

  it('評価があれば星で表示し、未評価なら表示しない', () => {
    expect(render({ rating: 4 }).text()).toContain('★★★★☆')
    expect(render({ rating: 0 }).find('[aria-label^="評価"]').exists()).toBe(false)
  })

  it('タイトルが本の詳細画面へのリンクになる', () => {
    const link = render({ id: 42 }).find('h2 a')
    expect(link.text()).toBe('吾輩は猫である')
    expect(link.attributes('href')).toBe('/books/42')
  })

  it('表紙があれば画像を、なければ代替表示を出す', () => {
    const withCover = render({ cover: 'https://example.com/c.jpg' })
    expect(withCover.find('img').attributes('src')).toBe('https://example.com/c.jpg')
    expect(render().find('img').exists()).toBe(false)
  })
})
