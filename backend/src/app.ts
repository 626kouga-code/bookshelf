import { Hono } from 'hono'
import { booksRoutes } from './books.ts'
import type { Db } from './db.ts'
import { ApiError } from './errors.ts'

export function createApp(db: Db) {
  const app = new Hono()

  app.get('/api/health', (c) => {
    db.prepare('SELECT 1').get()
    return c.json({ status: 'ok' })
  })

  app.route('/api/books', booksRoutes(db))

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.message }, err.status)
    console.error(err)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  app.notFound((c) => c.json({ error: 'Not Found' }, 404))

  return app
}
