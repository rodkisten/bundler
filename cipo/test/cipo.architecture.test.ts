/** @vitest-environment node */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Cipó package architecture invariants', () => {
  it('keeps the production graph acyclic, reachable and behind explicit public entrypoints', () => {
    const script = resolve(process.cwd(), 'cipo/scripts/check-architecture.mjs')
    const output = execFileSync(process.execPath, [script], { encoding: 'utf8' })

    expect(output).toContain('0 cycles')
    expect(output).toContain('0 unreachable modules')
  })
})
