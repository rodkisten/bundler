import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Cipó Vite adapter source loading', () => {
  it('keeps workspace aliases while loading Vite configs through tsx and the native config loader', () => {
    const root = process.cwd()
    const adapter = readFileSync(resolve(root, 'cipo/vite-compiled-inline.ts'), 'utf8')
    const devtoolsConfig = readFileSync(resolve(root, 'devtools/vite.config.ts'), 'utf8')
    const maquinaConfig = readFileSync(resolve(root, 'maquina/vite.config.ts'), 'utf8')
    const vitestConfig = readFileSync(resolve(root, 'vitest.config.ts'), 'utf8')
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }

    // Config-time imports are resolved by tsx before Vite starts. Vite 8 then
    // resolves application and test graph aliases natively from compilerOptions.paths.
    expect(adapter).toContain("from '@rodkisten/cipo/compiler-compiled-build'")
    expect(adapter).toContain("from '@rodkisten/fabrica/compiler'")
    expect(adapter).not.toMatch(/from ['"]\.\.?\//)

    for (const config of [devtoolsConfig, maquinaConfig, vitestConfig]) {
      expect(config).toContain('tsconfigPaths: true')
      expect(config).not.toContain('vite-tsconfig-paths')
    }

    expect(devtoolsConfig).not.toContain('alias: [')
    expect(maquinaConfig).not.toContain('alias: [')
    expect(packageJson.devDependencies['vite-tsconfig-paths']).toBeUndefined()

    for (const scriptName of ['dev:devtools', 'build:devtools', 'dev:maquina', 'build:maquina']) {
      expect(packageJson.scripts[scriptName]).toContain('node --import tsx')
      expect(packageJson.scripts[scriptName]).toContain('--configLoader native')
    }
  })
})
