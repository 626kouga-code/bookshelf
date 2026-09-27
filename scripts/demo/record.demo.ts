import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { seedDemo } from './seed.ts'

/** 書き出す動画（Git 管理外。GitHub にアップロードして README から参照する） */
const OUTPUT = fileURLToPath(new URL('../../demo/demo.webm', import.meta.url))

/** 見ている人が画面を読めるよう、場面ごとに少し止める */
const pause = (page: Page, ms = 1500) => page.waitForTimeout(ms)

/** 文字を1文字ずつ入力する（入力している様子が見えるように） */
const typeSlowly = (page: Page, locator: ReturnType<Page['locator']>, text: string) =>
  locator.pressSequentially(text, { delay: 90 })

// 録画はテストの page を作った時点から始まるので、時間のかかる準備は録画の前に済ませる
test.beforeAll(async ({ browser }) => {
  const result = await seedDemo()
  console.log('デモデータ:', result)
  // 開発サーバーは初回の表示でコンパイルに時間がかかるので、録画しない別のページで一通り開いておく
  const warmup = await browser.newPage()
  for (const path of ['/', '/books/1', '/books/new', '/stats', '/settings']) {
    await warmup.goto(`http://localhost:5173${path}`)
    await warmup.waitForLoadState('networkidle')
  }
  await warmup.close()
})

test('デモ動画を録画する', async ({ page }) => {

  // 本棚：表紙・シリーズ・タグ・お気に入り・積読日数
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(9)
  await page.waitForLoadState('networkidle')
  await pause(page, 2500)

  // タグで絞り込んで、解除する
  await page.getByRole('article').filter({ hasText: 'リーダブルコード' }).getByRole('button', { name: '#技術書' }).hover()
  await pause(page, 500)
  await page.getByRole('article').filter({ hasText: 'リーダブルコード' }).getByRole('button', { name: '#技術書' }).click()
  await pause(page)
  await page.getByRole('button', { name: 'タグ「技術書」の絞り込みを解除' }).click()
  await pause(page, 800)

  // シリーズで絞り込むと巻数順に並ぶ
  await page.getByRole('button', { name: '三体 3巻' }).click()
  await pause(page, 2000)
  await page.getByRole('button', { name: 'シリーズ「三体」の絞り込みを解除' }).click()
  await page.getByRole('combobox', { name: '並べ替え' }).selectOption({ label: '追加日が新しい順' })
  await pause(page, 800)

  // 読書中の本を開いて、今日の読書ログを記録する
  await page.getByRole('link', { name: 'リーダブルコード' }).click()
  await expect(page.getByRole('heading', { name: 'リーダブルコード' })).toBeVisible()
  await pause(page)
  await typeSlowly(page, page.getByLabel('読んだページ数', { exact: true }), '24')
  await page.getByRole('button', { name: '記録する' }).click()
  await pause(page, 2500)

  // 本を追加：タイトルで検索して、候補から選んで登録する
  await page.getByRole('link', { name: '本を追加' }).click()
  await typeSlowly(page, page.getByRole('searchbox', { name: '検索キーワード' }), '人間失格 太宰治')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  const firstCandidate = page.getByRole('list', { name: '検索結果' }).getByRole('button').first()
  await expect(firstCandidate).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await pause(page)
  await firstCandidate.click()
  await pause(page)
  await page.getByRole('button', { name: '登録する' }).click()
  await expect(page).toHaveURL('/')
  await page.waitForLoadState('networkidle')
  await pause(page, 2000)

  // 統計：読書ヒートマップ・月別読了数・目標
  await page.getByRole('link', { name: '統計・目標' }).click()
  await expect(page.getByRole('heading', { name: '読書ヒートマップ' })).toBeVisible()
  await pause(page, 2500)
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 250)
    await page.waitForTimeout(350)
  }
  await pause(page, 1500)

  // 設定でダークテーマに切り替える
  await page.getByRole('link', { name: '設定' }).click()
  await pause(page, 800)
  await page.getByLabel('ダーク').check()
  await pause(page, 1000)
  await page.getByRole('link', { name: '本棚' }).click()
  await page.waitForLoadState('networkidle')
  await pause(page, 2500)

  const video = page.video()
  await page.close()
  mkdirSync(fileURLToPath(new URL('../../demo/', import.meta.url)), { recursive: true })
  await video!.saveAs(OUTPUT)
  console.log(`録画を書き出しました: ${OUTPUT}`)
})
