import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'

const secret = 'k3yk3yk3yk3yk3yk3yk3yk3yk3yk3yk3'

// Gatus output for failing checks, with resolved limits, errors that carry URLs
// and hostnames. None of it may reach the public page.
const failing = [
  {
    name: 'Base',
    group: 'Bundlers',
    key: 'bundlers_base',
    results: [
      {
        status: 0,
        hostname: 'api.justaname.id',
        duration: 10_000_000_000,
        errors: [`Post "https://api.justaname.id/proxy/v1/rpc?chainId=8453&api-key=${secret}": context deadline exceeded`],
        conditionResults: [
          { condition: '[STATUS] (0) == 201', success: false },
          { condition: '[RESPONSE_TIME] (10000) < 5000', success: false },
        ],
        success: false,
        timestamp: '2026-11-23T17:32:43Z',
      },
    ],
  },
  {
    name: 'MCP server',
    group: 'Core services',
    key: 'core-services_mcp-server',
    results: [
      {
        status: 200,
        hostname: 'mcp.jaw.id',
        duration: 6_120_000_000,
        conditionResults: [
          { condition: '[STATUS] == 200', success: true },
          { condition: '[RESPONSE_TIME] (6120) < 3000', success: false },
          { condition: '[BODY].db == ok', success: true },
        ],
        success: false,
        timestamp: '2026-11-23T17:33:00Z',
      },
    ],
  },
]

const get = (path: string, load: () => Promise<unknown>) => createApp(load).request(path)

describe('GET /', () => {
  it('shows each check with its state and latency', async () => {
    const response = await get('/', () => Promise.resolve(failing))
    const page = await response.text()

    expect(response.status).toBe(200)
    expect(page).toContain('Partial <span class="accent">outage.</span>')
    expect(page).toMatch(/<li class="check down"><span class="name">Base<\/span>.*?Down.*?10000 ms/)
    expect(page).toMatch(/<li class="check degraded"><span class="name">MCP server<\/span>.*?Degraded.*?6120 ms/)
  })

  it('never shows conditions, limits, errors, hostnames or the api key', async () => {
    const page = await (await get('/', () => Promise.resolve(failing))).text()

    for (const internal of ['RESPONSE_TIME', '[STATUS]', '[BODY]', '3000', '5000', 'deadline', 'api-key', secret, 'api.justaname.id', 'mcp.jaw.id']) {
      expect(page).not.toContain(internal)
    }
  })

  it('answers 503 when Gatus cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await get('/', () => Promise.reject(new Error('connect ECONNREFUSED')))

    expect(response.status).toBe(503)
    expect(await response.text()).toContain('Status <span class="accent">unavailable.</span>')
  })

  it('answers 503 when Gatus answers something unexpected or has no probes yet', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect((await get('/', () => Promise.resolve({ error: 'not found' }))).status).toBe(503)
    expect((await get('/', () => Promise.resolve([]))).status).toBe(503)
  })
})

describe('public origin', () => {
  it('serves no Gatus route', async () => {
    const load = () => Promise.resolve(failing)

    expect((await get('/api/v1/endpoints/statuses', load)).status).toBe(404)
    expect((await get('/metrics', load)).status).toBe(404)
  })

  it('serves the page assets with a cache header', async () => {
    const response = await get('/static/styles.css', () => Promise.resolve(failing))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
  })
})
