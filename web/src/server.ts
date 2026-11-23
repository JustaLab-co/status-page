import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { fetchStatuses } from './gatus.js'

const gatusUrl = process.env['GATUS_URL'] ?? 'http://localhost:8080'
const port = Number(process.env['PORT'] ?? 3000)

const app = createApp(() => fetchStatuses(gatusUrl))

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`status page on :${info.port}, reading ${gatusUrl}`)
})
