import { parse } from 'yaml'
import { z } from 'zod'

const result = z.object({
  success: z.boolean(),
  duration: z.number(),
  timestamp: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  conditionResults: z.array(z.object({ condition: z.string(), success: z.boolean() })).default([]),
  errors: z.array(z.string()).default([]),
})

const endpoint = z.object({
  name: z.string(),
  group: z.string().default('Other'),
  results: z.array(result),
})

export type Result = z.infer<typeof result>

export interface Probe {
  name: string
  group: string
  latest: Result
}

// Keeps only the fields the public page may show or needs to judge a result.
// Everything else Gatus sends (hostnames, HTTP statuses) is dropped here.
export function parseProbes(raw: unknown): Probe[] {
  return z
    .array(endpoint)
    .parse(raw)
    .flatMap(({ name, group, results }) => {
      const latest = results.at(-1)
      return latest ? [{ name, group, latest }] : []
    })
}

// Gatus lists a check only after its first result, so the page compares what it
// got with what the config declares.
export function countChecks(configYaml: string): number {
  return z.object({ endpoints: z.array(z.unknown()) }).parse(parse(configYaml)).endpoints.length
}

export async function fetchStatuses(gatusUrl: string): Promise<unknown> {
  const response = await fetch(new URL('/api/v1/endpoints/statuses?pageSize=1', gatusUrl), {
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`Gatus answered ${response.status}`)
  return response.json()
}
