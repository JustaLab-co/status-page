import type { Probe, Result } from './gatus.js'

export type State = 'up' | 'degraded' | 'down'
export type Headline = 'operational' | 'degraded' | 'partial-outage' | 'major-outage'

export interface Check {
  name: string
  state: State
  latencyMs: number
}

export interface Section {
  name: string
  checks: Check[]
}

export interface Board {
  headline: Headline
  sections: Section[]
  checkedAt: Date
}

const SECTION_ORDER = ['Core services', 'Bundlers', 'ENS resolution']

// A result that only missed its response-time limits answered correctly, just
// slowly. Anything else that failed (an error, a status, a body) is down.
export function stateOf(result: Result): State {
  if (result.success) return 'up'
  const failed = result.conditionResults.filter((c) => !c.success)
  const slowOnly =
    result.errors.length === 0 &&
    failed.length > 0 &&
    failed.every((c) => c.condition.startsWith('[RESPONSE_TIME]'))
  return slowOnly ? 'degraded' : 'down'
}

function headlineOf(states: State[]): Headline {
  if (states.every((s) => s === 'down')) return 'major-outage'
  if (states.includes('down')) return 'partial-outage'
  if (states.includes('degraded')) return 'degraded'
  return 'operational'
}

const toCheck = ({ name, latest }: Probe): Check => ({
  name,
  state: stateOf(latest),
  latencyMs: Math.round(latest.duration / 1e6),
})

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

function sectionRank(name: string): number {
  const index = SECTION_ORDER.indexOf(name)
  return index === -1 ? SECTION_ORDER.length : index
}

export function toBoard(probes: Probe[]): Board | undefined {
  if (probes.length === 0) return undefined

  const sections = [...Map.groupBy(probes, (p) => p.group)]
    .map(([name, members]) => ({ name, checks: members.map(toCheck).sort(byName) }))
    .sort((a, b) => sectionRank(a.name) - sectionRank(b.name) || byName(a, b))

  return {
    headline: headlineOf(sections.flatMap((s) => s.checks.map((c) => c.state))),
    sections,
    checkedAt: new Date(Math.max(...probes.map((p) => p.latest.timestamp.getTime()))),
  }
}
