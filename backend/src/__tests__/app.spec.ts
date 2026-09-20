import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { openDb } from '../db.ts'

describe('app', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    app = createApp(openDb(':memory:'))
  })

  it('GET /api/health は ok を返す', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('未定義のパスは { error } 形式の404を返す', async () => {
    const res = await app.request('/api/unknown')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not Found' })
  })
})
