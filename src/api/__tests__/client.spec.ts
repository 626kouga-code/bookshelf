import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError, request } from '../client'

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功時はJSONを返す', async () => {
    stubFetch(Response.json({ status: 'ok' }))
    expect(await request('/api/health')).toEqual({ status: 'ok' })
  })

  it('204 は undefined を返す', async () => {
    stubFetch(new Response(null, { status: 204 }))
    expect(await request('/api/books/1', { method: 'DELETE' })).toBeUndefined()
  })

  it('エラー応答は { error } のメッセージとステータスを持つ例外にする', async () => {
    stubFetch(Response.json({ error: '本が見つかりません' }, { status: 404 }))
    await expect(request('/api/books/9')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 404,
      message: '本が見つかりません',
    })
  })

  it('JSONでないエラー応答は既定のメッセージにする', async () => {
    stubFetch(new Response('Bad Gateway', { status: 502 }))
    const error = await request('/api/books').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ status: 502, message: 'リクエストに失敗しました（502）' })
  })

  it('通信に失敗したら status 0 の例外にする', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    await expect(request('/api/books')).rejects.toMatchObject({
      status: 0,
      message: 'サーバーに接続できません',
    })
  })
})
