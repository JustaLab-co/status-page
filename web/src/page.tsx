import type { FC, PropsWithChildren } from 'hono/jsx'
import type { Board, Check, Headline, Section, State } from './board.js'

const STATE_LABEL: Record<State, string> = {
  up: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
}

const HEADLINE: Record<Headline, [lead: string, accent: string]> = {
  operational: ['All systems', 'operational.'],
  degraded: ['Degraded', 'performance.'],
  'partial-outage': ['Partial', 'outage.'],
  'major-outage': ['Major', 'outage.'],
}

const utc = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

const Layout: FC<PropsWithChildren> = ({ children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta http-equiv="refresh" content="60" />
      <title>JAW Status</title>
      <meta name="description" content="Live status of the JAW MCP server, bundlers, paymaster and ENS resolution." />
      <link rel="icon" href="/static/jaw-mark.svg" type="image/svg+xml" />
      <link rel="preload" href="/static/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
      <link rel="stylesheet" href="/static/styles.css" />
    </head>
    <body>
      <header class="nav">
        <a class="brand" href="/">
          <img src="/static/jaw-mark.svg" alt="" width="20" height="22" />
          <span>
            JAW<span class="suffix">.id</span>
          </span>
        </a>
        <span class="pill">Status</span>
        <a class="button" href="https://jaw.id">
          Visit jaw.id
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      </header>
      <main>{children}</main>
      <footer class="footer">
        <a href="https://jaw.id">Home</a>
        <a href="https://justalab.co">JustaLab</a>
      </footer>
    </body>
  </html>
)

const CheckRow: FC<{ check: Check }> = ({ check }) => (
  <li class={`check ${check.state}`}>
    <span class="name">{check.name}</span>
    <span class="state">
      <i class="dot" aria-hidden="true" />
      {STATE_LABEL[check.state]}
    </span>
    <span class="latency">{check.latencyMs} ms</span>
  </li>
)

const SectionCard: FC<{ section: Section }> = ({ section }) => {
  const up = section.checks.filter((c) => c.state === 'up').length
  return (
    <section class="card">
      <div class="card-head">
        <h2>{section.name}</h2>
        <p class="label">
          {up} of {section.checks.length} operational
        </p>
      </div>
      <ul class="checks">
        {section.checks.map((check) => (
          <CheckRow check={check} />
        ))}
      </ul>
    </section>
  )
}

export const BoardPage: FC<{ board: Board }> = ({ board }) => {
  const [lead, accent] = HEADLINE[board.headline]
  return (
    <Layout>
      <section class="hero">
        <h1 class={`headline ${board.headline}`}>
          {lead} <span class="accent">{accent}</span>
        </h1>
        <p class="lede">Live health of the JAW MCP server, the bundler on each chain, the paymaster and ENS resolution.</p>
        <p class="label">
          Last check <time datetime={board.checkedAt.toISOString()}>{utc.format(board.checkedAt)} UTC</time>
        </p>
      </section>
      {board.sections.map((section) => (
        <SectionCard section={section} />
      ))}
    </Layout>
  )
}

export const UnavailablePage: FC = () => (
  <Layout>
    <section class="hero">
      <h1 class="headline unavailable">
        Status <span class="accent">unavailable.</span>
      </h1>
      <p class="lede">The health checks cannot be read right now. This page tries again every minute.</p>
    </section>
  </Layout>
)
