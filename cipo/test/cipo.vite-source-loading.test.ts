import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Cipó Vite adapter source loading', () => {
  it('does not require prebuilt workspace package exports while loading vite.config.ts', () => {
    const source = readFileSync(resolve(process.cwd(), 'cipo/vite-compiled-inline.ts'), 'utf8')

    // Vite loads config dependencies before config-level aliases exist. Keep compiler
    // internals relative so clean source checkouts never resolve package exports to
    // not-yet-generated JavaScript files such as compiler-compiled-build.js.
    expect(source).not.toMatch(/from ['"]@rodkisten\/(?:cipo|fabrica)\//)
    expect(source).toContain("from './compiler-compiled-build.js'")
    expect(source).toContain("from '../fabrica/compiler.js'")
  })
})
