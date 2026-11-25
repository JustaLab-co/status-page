import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countChecks } from './gatus.js'

describe('countChecks', () => {
  it('counts the endpoints in a Gatus config', () => {
    expect(countChecks('endpoints:\n  - name: a\n  - name: b\n')).toBe(2)
  })

  it('reads the config this repo deploys', () => {
    expect(countChecks(readFileSync('../config.yaml', 'utf8'))).toBeGreaterThan(0)
  })

  it('rejects a config without endpoints', () => {
    expect(() => countChecks('alerting: {}\n')).toThrow()
  })
})
