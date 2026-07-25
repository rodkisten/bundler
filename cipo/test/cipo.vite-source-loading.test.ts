import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Cipó Vite adapter package boundaries', () => {
  it('uses the public Vite entrypoint and keeps a single implementation', () => {
    const root = process.cwd()
    const adapter = readFileSync(resolve(root, 'cipo/integrations/vite/plugin.ts'), 'utf8')
    const devtoolsConfig = readFileSync(resolve(root, 'devtools/vite.config.ts'), 'utf8')
    const maquinaConfig = readFileSync(resolve(root, 'maquina/vite.config.ts'), 'utf8')
    const vitestConfig = readFileSync(resolve(root, 'vitest.config.ts'), 'utf8')
    const sharedProjectConfigs = readFileSync(
      resolve(root, 'scripts/vite/project-configs.ts'),
      'utf8',
    )
    const sharedViteConfig = readFileSync(
      resolve(root, 'scripts/vite/shared-config.ts'),
      'utf8',
    )
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }

    expect(adapter).toContain("import('@rodkisten/fabrica/compiler')")
    expect(adapter).not.toContain("from '@rodkisten/fabrica/compiler'")
    expect(adapter).toMatch(/const CIPO_COMPILED_RUNTIME = [\"']@rodkisten\/cipo\/compiled-runtime[\"']/)
    expect(adapter).toMatch(/const CIPO_COMPILER = [\"']@rodkisten\/cipo\/compiler[\"']/)
    expect(sharedProjectConfigs).toContain('from "@rodkisten/cipo/vite"')
    expect(devtoolsConfig).toContain('createDevtoolsProjectConfig')
    expect(maquinaConfig).toContain('createMaquinaProjectConfig')

    // The old fork in Máquina and the root-level adapter were a real source of divergence.
    expect(existsSync(resolve(root, 'cipo/vite-compiled-inline.ts'))).toBe(false)
    expect(existsSync(resolve(root, 'maquina/vite-compiled-inline.ts'))).toBe(false)

    for (const config of [sharedViteConfig, vitestConfig]) {
      expect(config).toContain('tsconfigPaths: true')
      expect(config).not.toContain('vite-tsconfig-paths')
    }

    expect(sharedProjectConfigs).not.toContain('alias: [')
    expect(devtoolsConfig).not.toContain('alias: [')
    expect(maquinaConfig).not.toContain('alias: [')
    expect(packageJson.devDependencies['vite-tsconfig-paths']).toBeUndefined()

    for (const scriptName of ['dev:devtools', 'build:devtools', 'dev:maquina', 'build:maquina']) {
      expect(packageJson.scripts[scriptName]).toContain('node --import tsx')
      expect(packageJson.scripts[scriptName]).toContain('--configLoader native')
    }
  })
})
