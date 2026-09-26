import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** 本を追加画面から、シリーズ・巻数・タグ付きで登録する。 */
async function addBook(page: Page, book: { title: string; series?: string; volume?: number; tags?: string }) {
  await page.goto('/books/new')
  await page.getByRole('textbox', { name: 'タイトル', exact: true }).fill(book.title)
  if (book.series) await page.getByLabel('シリーズ', { exact: true }).fill(book.series)
  if (book.volume) await page.getByLabel('巻数', { exact: true }).fill(String(book.volume))
  if (book.tags) await page.getByLabel('タグ', { exact: true }).fill(book.tags)
  await page.getByRole('button', { name: '登録する' }).click()
  await expect(page).toHaveURL('/')
}

const cardTitles = (page: Page) => page.getByRole('article').getByRole('heading')

test('シリーズ・タグで絞り込み、お気に入りに追加した本だけを表示できる', async ({ page }) => {
  // 巻数の逆順に登録し、シリーズ順で巻数どおりに並ぶことを確かめる
  await addBook(page, { title: '三体Ⅲ 死神永生', series: '三体', volume: 3, tags: 'SF' })
  await addBook(page, { title: '三体', series: '三体', volume: 1, tags: 'SF、名作' })
  await addBook(page, { title: '坊っちゃん', tags: '名作' })

  // カードのシリーズを押すと、そのシリーズの本だけが巻数順に並ぶ
  await page.getByRole('button', { name: '三体 3巻' }).click()
  await expect(page.getByLabel('絞り込み中の条件')).toContainText('シリーズ: 三体')
  await expect(cardTitles(page)).toHaveText(['三体', '三体Ⅲ 死神永生'])
  await page.getByRole('button', { name: 'シリーズ「三体」の絞り込みを解除' }).click()
  await expect(cardTitles(page)).toHaveCount(3)

  // カードのタグを押すと、そのタグの本だけになる
  await page.getByRole('article').filter({ hasText: '坊っちゃん' }).getByRole('button', { name: '#名作' }).click()
  await expect(page.getByLabel('絞り込み中の条件')).toContainText('タグ: #名作')
  await expect(cardTitles(page)).toHaveCount(2)
  await page.getByRole('button', { name: 'タグ「名作」の絞り込みを解除' }).click()

  // 詳細画面でお気に入りに追加すると、本棚の「お気に入り」で絞り込める
  await page.getByRole('link', { name: '坊っちゃん' }).click()
  await page.getByRole('button', { name: 'お気に入りに追加' }).click()
  await expect(page.getByRole('button', { name: 'お気に入りから外す' })).toBeVisible()
  await page.getByRole('link', { name: '← 本棚に戻る' }).click()

  await page.getByRole('button', { name: 'お気に入り' }).click()
  await expect(cardTitles(page)).toHaveText(['★坊っちゃん'])
})
