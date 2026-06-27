import { describe, expect, it } from 'vitest'
import { compareSnapshots, renderBenchmarkMarkdown } from './report'

describe('legacy benchmark report module', () => {
  it('re-exports the current report API', () => {
    expect(typeof compareSnapshots).toBe('function')
    expect(typeof renderBenchmarkMarkdown).toBe('function')
  })
})
