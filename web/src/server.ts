import { readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { countChecks, fetchStatuses } from './gatus.js'

const gatusUrl = process.env['GATUS_URL'] ?? 'http://localhost:8080'
const port = Number(process.env['PORT'] ?? 3000)
const configuredChecks = countChecks(readFileSync(process.env['GATUS_CONFIG'] ?? '../config.yaml', 'utf8'))

const app = createApp(() => fetchStatuses(gatusUrl), configuredChecks)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`status page on :${info.port}, reading ${configuredChecks} checks from ${gatusUrl}`)
})
