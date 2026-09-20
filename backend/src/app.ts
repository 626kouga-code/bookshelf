import { Hono } from 'hono'
import type { Db } from './db.ts'

export function createApp(db: Db) {
  const app = new Hono()

  app.get('/api/health', (c) => {
    db.prepare('SELECT 1').get()
    return c.json({ status: 'ok' })
  })

  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  app.notFound((c) => c.json({ error: 'Not Found' }, 404))

  return app
}
