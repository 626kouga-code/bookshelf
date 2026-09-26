import { readFile } from 'node:fs/promises'
import { expect, test } from './fixtures'

test('設定画面から本の一覧をCSVでダウンロードできる', async ({ page, request }) => {
  // カンマ・ダブルクォートを含む値も1つのセルに収まることを確かめる
  await request.post('http://127.0.0.1:8080/api/books', {
    data: { title: 'Hello, "World"', authors: ['著者A', '著者B'], pages: 100, tags: ['技術書'], favorite: true },
  })
  await request.post('http://127.0.0.1:8080/api/books', { data: { title: '坊っちゃん', status: 'done' } })

  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSVエクスポート' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^reading-app-books-\d{8}\.csv$/)
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv.startsWith('﻿')).toBe(true)

  const rows = csv.slice(1).trimEnd().split('\r\n')
  expect(rows).toHaveLength(3)
  expect(rows[0]).toMatch(/^タイトル,著者,ISBN,/)
  // 登録の古い順
  expect(rows[1]).toMatch(/^"Hello, ""World""",著者A、著者B,,100,,,,技術書,読みたい,,,★,/)
  expect(rows[2]).toMatch(/^坊っちゃん,.*,読了,/)
})
