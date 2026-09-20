import { resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

const PORT = 8080
const HOST = '127.0.0.1'

const db = openDb(process.env.DB_PATH ?? resolve(import.meta.dirname, '../data/reading.db'))
const app = createApp(db)

// ポートが埋まっていたら別ポートへ逃げずに起動失敗させる
const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`API server listening on http://${info.address}:${info.port}`)
})
server.on('error', (err) => {
  console.error(err)
  process.exit(1)
})
