import { Hono } from 'hono'
import { booksRoutes } from './books.ts'
import type { Db } from './db.ts'
import { ApiError } from './errors.ts'
import { goalsRoutes } from './goals.ts'
import { logsRoutes, predictionRoutes } from './logs.ts'
import { quoteSearchRoutes, quotesRoutes } from './quotes.ts'
import { statsRoutes } from './stats.ts'

export function createApp(db: Db) {
  const app = new Hono()

  app.get('/api/health', (c) => {
    db.prepare('SELECT 1').get()
    return c.json({ status: 'ok' })
  })

  app.route('/api/books', booksRoutes(db))
  app.route('/api/books/:id/logs', logsRoutes(db))
  app.route('/api/books/:id/prediction', predictionRoutes(db))
  app.route('/api/books/:id/quotes', quotesRoutes(db))
  app.route('/api/quotes', quoteSearchRoutes(db))
  app.route('/api/stats', statsRoutes(db))
  app.route('/api/goals', goalsRoutes(db))

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.message }, err.status)
    console.error(err)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  app.notFound((c) => c.json({ error: 'Not Found' }, 404))

  return app
}
