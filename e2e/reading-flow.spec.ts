import type { Page } from '@playwright/test'
import { expect, test, todayKey } from './fixtures'

/** 本を追加画面から手入力で登録し、本棚に戻るまで待つ。 */
async function addBook(page: Page, book: { title: string; authors?: string; pages?: number }) {
  await page.goto('/books/new')
  await page.getByRole('textbox', { name: 'タイトル', exact: true }).fill(book.title)
  if (book.authors) await page.getByLabel('著者', { exact: true }).fill(book.authors)
  if (book.pages) await page.getByLabel('総ページ数', { exact: true }).fill(String(book.pages))
  await page.getByRole('button', { name: '登録する' }).click()
  await expect(page).toHaveURL('/')
}

test('本を手入力で追加すると本棚に表示され、詳細画面を開ける', async ({ page }) => {
  await addBook(page, { title: '吾輩は猫である', authors: '夏目漱石', pages: 300 })

  const card = page.getByRole('article').filter({ hasText: '吾輩は猫である' })
  await expect(card).toContainText('夏目漱石')
  await expect(card).toContainText('読みたい')
  await expect(card).toContainText('積読 0日')

  await card.getByRole('link', { name: '吾輩は猫である' }).click()
  await expect(page).toHaveURL(/\/books\/\d+$/)
  await expect(page.getByRole('heading', { name: '吾輩は猫である' })).toBeVisible()
})

test('読書ログを記録すると、進捗と統計（累計ページ・ヒートマップ）に反映される', async ({ page }) => {
  await addBook(page, { title: 'リーダブルコード', pages: 200 })
  await page.getByRole('link', { name: 'リーダブルコード' }).click()

  await page.getByRole('button', { name: '読み始める' }).click()
  await page.getByLabel('読んだページ数', { exact: true }).fill('50')
  await page.getByRole('button', { name: '記録する' }).click()

  // 記録したページ数だけ現在のページが進み、進捗に反映される
  await expect(page.getByText('50 / 200 ページ（25%）')).toBeVisible()

  await page.getByRole('link', { name: '統計・目標' }).click()
  await expect(page.getByRole('heading', { name: '統計・目標' })).toBeVisible()
  await expect(page.getByText('累計読書ページ数').locator('..')).toContainText('50')

  const heatmap = page.getByRole('region', { name: '読書ヒートマップ' })
  await expect(heatmap).toContainText('直近1年で 1日・50ページ読書')
  await expect(heatmap.locator(`rect[data-date="${todayKey()}"]`)).toHaveAttribute('data-level', '4')
})

test('引用を登録すると、引用検索で見つかる', async ({ page }) => {
  await addBook(page, { title: '坊っちゃん' })
  await page.getByRole('link', { name: '坊っちゃん' }).click()

  await page.getByPlaceholder('心に残った一節をメモ').fill('親譲りの無鉄砲で小供の時から損ばかりしている。')
  await page.getByLabel('ページ', { exact: true }).fill('5')
  await page.getByRole('button', { name: '引用を追加' }).click()
  await expect(page.getByText('親譲りの無鉄砲で小供の時から損ばかりしている。')).toBeVisible()

  await page.getByRole('link', { name: '引用検索' }).click()
  await page.getByRole('searchbox', { name: 'キーワード検索' }).fill('無鉄砲')

  const result = page.getByRole('listitem').filter({ hasText: '無鉄砲' })
  await expect(result).toContainText('坊っちゃん')
  await expect(result).toContainText('p.5')

  await page.getByRole('searchbox', { name: 'キーワード検索' }).fill('存在しない言葉')
  await expect(page.getByText('条件に合う引用はありません。')).toBeVisible()
})
