import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const API = 'http://127.0.0.1:8080/api/books'
const cardTitles = (page: Page) => page.getByRole('article').getByRole('heading')

test('本棚をジャンル・著者・評価で絞り込める', async ({ page, request }) => {
  await request.post(API, { data: { title: '坊っちゃん', authors: ['夏目漱石'], genre: '小説', rating: 4 } })
  await request.post(API, { data: { title: 'こころ', authors: ['夏目漱石'], genre: '小説' } })
  await request.post(API, { data: { title: 'リーダブルコード', authors: ['Dustin Boswell'], genre: '技術書', rating: 5 } })

  await page.goto('/')
  await expect(cardTitles(page)).toHaveCount(3)

  // カードの著者を押すと、その著者の本だけになる
  await page.getByRole('article').filter({ hasText: '坊っちゃん' }).getByRole('button', { name: '夏目漱石' }).click()
  await expect(page.getByLabel('絞り込み中の条件')).toContainText('著者: 夏目漱石')
  await expect(cardTitles(page)).toHaveCount(2)
  await page.getByRole('button', { name: '著者「夏目漱石」の絞り込みを解除' }).click()
  await expect(cardTitles(page)).toHaveCount(3)

  // カードのジャンルを押すと、そのジャンルの本だけになる
  await page.getByRole('article').filter({ hasText: 'リーダブルコード' }).getByRole('button', { name: '技術書' }).click()
  await expect(cardTitles(page)).toHaveText(['リーダブルコード'])
  await page.getByRole('button', { name: 'ジャンル「技術書」の絞り込みを解除' }).click()

  // 評価で絞り込む（未評価も選べる）
  const rating = page.getByLabel('評価で絞り込み')
  await rating.selectOption({ label: '★★★★☆' })
  await expect(cardTitles(page)).toHaveText(['坊っちゃん'])
  await rating.selectOption({ label: '未評価' })
  await expect(cardTitles(page)).toHaveText(['こころ'])
  await rating.selectOption({ label: '評価: すべて' })
  await expect(cardTitles(page)).toHaveCount(3)
})
