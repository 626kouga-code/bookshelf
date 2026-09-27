import { expect, test } from './fixtures'

// ビルドした画面（vite preview）に対して確かめる（開発サーバーでは Service Worker を動かさないため）
test.use({ baseURL: 'http://localhost:4173' })

test('manifest にアプリ名・アイコンがあり、ホーム画面に追加できる形になっている', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()

  const manifest = await (await request.get(`http://localhost:4173/${href!.replace(/^\//, '')}`)).json()
  expect(manifest).toMatchObject({ name: '読書管理アプリ', display: 'standalone', start_url: '/' })
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)

  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(`http://localhost:4173/${icon.src}`)).status()).toBe(200)
  }
  await expect(page).toHaveTitle('読書管理アプリ')
})

test('Service Worker が画面をキャッシュし、オフラインでも画面が開く（APIはキャッシュしない）', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // 最初の読み込みはまだ Service Worker の管理下にないので、一度読み込み直す
  await page.reload()
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

  await context.setOffline(true)
  try {
    await page.goto('/stats')
    await expect(page.getByRole('heading', { name: '読書管理アプリ' })).toBeVisible()
    // API はキャッシュしていないので、取得に失敗したことが表示される
    await expect(page.getByRole('alert')).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
