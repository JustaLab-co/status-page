import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { toBoard, type Board } from './board.js'
import { parseProbes } from './gatus.js'

const passed = (condition: string) => ({ condition, success: true })
const failed = (condition: string) => ({ condition, success: false })

// One Gatus endpoint status as /api/v1/endpoints/statuses returns it.
function endpoint(name: string, group = 'Bundlers', result: object = {}) {
  return {
    name,
    group,
    key: `${group}_${name}`,
    results: [
      {
        status: 201,
        hostname: 'api.justaname.id',
        duration: 1_234_567_890,
        conditionResults: [passed('[STATUS] == 201'), passed('[RESPONSE_TIME] < 5000')],
        success: true,
        timestamp: '2026-11-23T17:32:43.05023605Z',
        ...result,
      },
    ],
  }
}

const boardOf = (...endpoints: object[]) => toBoard(parseProbes(endpoints))

const stateOf = (board: Board | undefined, name: string) =>
  board?.sections.flatMap((s) => s.checks).find((c) => c.name === name)?.state

describe('check state', () => {
  it('is up when every condition passed', () => {
    expect(stateOf(boardOf(endpoint('Base')), 'Base')).toBe('up')
  })

  it('is degraded when the answer was right but slower than the limit', () => {
    const slow = endpoint('Base', 'Bundlers', {
      success: false,
      conditionResults: [
        passed('[STATUS] == 201'),
        failed('[RESPONSE_TIME] (6120) < 5000'),
        passed('[BODY].result == 0x2105'),
      ],
    })
    expect(stateOf(boardOf(slow), 'Base')).toBe('degraded')
  })

  it('is down for a wrong status, a wrong body, a request error or a result without details', () => {
    const board = boardOf(
      endpoint('Wrong status', 'Bundlers', {
        success: false,
        conditionResults: [failed('[STATUS] (403) == 201'), passed('[RESPONSE_TIME] < 5000')],
      }),
      endpoint('Wrong body', 'Bundlers', {
        success: false,
        conditionResults: [passed('[STATUS] == 201'), failed('[BODY].result (0x1) == 0x2105')],
      }),
      endpoint('Timeout', 'Bundlers', {
        success: false,
        errors: ['Post "<redacted>": context deadline exceeded'],
        conditionResults: [failed('[RESPONSE_TIME] (10000) < 5000')],
      }),
      endpoint('No details', 'Bundlers', { success: false, conditionResults: undefined }),
    )
    expect(['Wrong status', 'Wrong body', 'Timeout', 'No details'].map((name) => stateOf(board, name))).toEqual([
      'down',
      'down',
      'down',
      'down',
    ])
  })

  it('is down when a slow answer is also wrong', () => {
    const slowAndBroken = endpoint('Base', 'Bundlers', {
      success: false,
      conditionResults: [failed('[STATUS] (502) == 201'), failed('[RESPONSE_TIME] (6120) < 5000')],
    })
    expect(stateOf(boardOf(slowAndBroken), 'Base')).toBe('down')
  })
})

describe('a real Gatus v5.38.0 payload', () => {
  // Captured with the MCP check pointed at a missing path and Base given a 1 ms limit.
  const raw: unknown = JSON.parse(
    readFileSync(new URL('./fixtures/gatus-v5.38.0-statuses.json', import.meta.url), 'utf8'),
  )

  it('reads as up, down and degraded', () => {
    const board = toBoard(parseProbes(raw))
    expect(['API gateway', 'MCP server', 'Base'].map((name) => stateOf(board, name))).toEqual([
      'up',
      'down',
      'degraded',
    ])
  })
})

describe('headline', () => {
  const slow = { success: false, conditionResults: [failed('[RESPONSE_TIME] (6120) < 5000')] }
  const broken = { success: false, conditionResults: [failed('[STATUS] (500) == 201')] }

  it('is operational when every check is up', () => {
    expect(boardOf(endpoint('Base'), endpoint('Ink'))?.headline).toBe('operational')
  })

  it('is degraded when a check is slow and none is down', () => {
    expect(boardOf(endpoint('Base'), endpoint('Ink', 'Bundlers', slow))?.headline).toBe('degraded')
  })

  it('is a partial outage when some checks are down', () => {
    const board = boardOf(endpoint('Base'), endpoint('Ink', 'Bundlers', slow), endpoint('Linea', 'Bundlers', broken))
    expect(board?.headline).toBe('partial-outage')
  })

  it('is a major outage when every check is down', () => {
    expect(boardOf(endpoint('Base', 'Bundlers', broken), endpoint('Ink', 'Bundlers', broken))?.headline).toBe(
      'major-outage',
    )
  })
})

describe('board', () => {
  it('orders sections as published and sorts checks by name', () => {
    const board = boardOf(
      endpoint('Reverse resolution', 'ENS resolution'),
      endpoint('Ink'),
      endpoint('MCP server', 'Core services'),
      endpoint('Something new', 'Analytics'),
      endpoint('Base'),
      endpoint('API gateway', 'Core services'),
    )
    expect(board?.sections.map((s) => [s.name, s.checks.map((c) => c.name)])).toEqual([
      ['Core services', ['API gateway', 'MCP server']],
      ['Bundlers', ['Base', 'Ink']],
      ['ENS resolution', ['Reverse resolution']],
      ['Analytics', ['Something new']],
    ])
  })

  it('reports latency in milliseconds and the time of the newest probe', () => {
    const board = boardOf(
      endpoint('Base', 'Bundlers', { duration: 812_400_000, timestamp: '2026-11-23T17:30:00Z' }),
      endpoint('Ink', 'Bundlers', { timestamp: '2026-11-23T17:35:10.5Z' }),
    )
    expect(board?.sections[0]?.checks.map((c) => c.latencyMs)).toEqual([812, 1235])
    expect(board?.checkedAt.toISOString()).toBe('2026-11-23T17:35:10.500Z')
  })

  it('has nothing to show before the first probe', () => {
    expect(boardOf()).toBeUndefined()
    expect(boardOf({ name: 'Base', group: 'Bundlers', results: [] })).toBeUndefined()
  })
})
