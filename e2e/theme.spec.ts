import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const html = (page: Page) => page.locator('html')

/** 画面の背景色の明るさ（0〜255）。ダークなら暗い値になる。 */
async function backgroundLightness(page: Page): Promise<number> {
  return page.locator('#app > div').evaluate((el) => {
    // 背景色は oklch() で返ることもあるため、1px のキャンバスに塗って RGB を読む
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.fillStyle = getComputedStyle(el).backgroundColor
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return (r! + g! + b!) / 3
  })
}

test('設定画面でダークを選ぶと暗い配色になり、再読み込みしても保たれる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/settings')
  await expect(html(page)).toHaveAttribute('data-theme', 'light')
  expect(await backgroundLightness(page)).toBeGreaterThan(200)

  await page.getByLabel('ダーク').check()
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  expect(await backgroundLightness(page)).toBeLessThan(60)

  await page.reload()
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByLabel('ダーク')).toBeChecked()

  // 他の画面にも反映される
  await page.getByRole('link', { name: '本棚' }).click()
  expect(await backgroundLightness(page)).toBeLessThan(60)
})

test('「システムに合わせる」ではOSの設定に従う', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/settings')
  await expect(page.getByLabel('システムに合わせる')).toBeChecked()
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html(page)).toHaveAttribute('data-theme', 'light')

  await page.getByLabel('ライト').check()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html(page)).toHaveAttribute('data-theme', 'light')
})
