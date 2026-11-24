import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { html } from 'hono/html'
import { secureHeaders } from 'hono/secure-headers'
import { toBoard } from './board.js'
import { parseProbes } from './gatus.js'
import { BoardPage, UnavailablePage } from './page.js'

export function createApp(loadStatuses: () => Promise<unknown>, configuredChecks: number): Hono {
  const app = new Hono()

  app.use(secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'self'"] } }))

  app.use(
    '/static/*',
    async (c, next) => {
      await next()
      if (c.res.ok) c.header('Cache-Control', 'public, max-age=3600')
    },
    serveStatic({ root: './' }),
  )

  app.get('/', async (c) => {
    c.header('Cache-Control', 'no-store')
    const board = await loadStatuses()
      .then(parseProbes)
      .then((probes) => (probes.length < configuredChecks ? undefined : toBoard(probes)))
      .catch((error: unknown) => {
        console.error('cannot read Gatus statuses', error)
        return undefined
      })
    if (!board) return c.html(html`<!doctype html>${<UnavailablePage />}`, 503)
    return c.html(html`<!doctype html>${<BoardPage board={board} />}`)
  })

  return app
}
