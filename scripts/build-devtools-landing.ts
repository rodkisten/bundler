import fs from 'node:fs/promises'
import path from 'node:path'
import {
  build as buildWithVite,
  type Plugin,
} from 'vite'
import { cipoVite } from '@rodkisten/cipo/vite'
import { devtoolsCipoConfigCss } from '../devtools/cipo-config'
import {
  DIST_DIR,
  ROOT_DIR,
  WORKSPACE_PACKAGES,
  workspaceSourceCandidates,
} from './config'

export const DEVTOOLS_LANDING_DIR = path.join(
  DIST_DIR,
  'devtools',
)

export type BuildDevtoolsLandingOptions = {
  readonly outputDirectory?: string
  readonly minify?: boolean
  readonly sourcemap?: boolean
}

/**
 * Converts the development HTML entry into a static, relocatable Pages entry.
 *
 * The generated landing bundle remains a native ES module. Vite owns the
 * TypeScript/module graph while this small transform only changes the public
 * URL from the source entry to the emitted module.
 */
export function createBuiltDevtoolsLandingHtml(
  source: string,
): string {
  return source
    .replace(
      /\s*<base\s+href=["'][^"']*["']\s*\/?>(?:\s*)/i,
      '\n',
    )
    .replace(
      /href=["']\/landing\.css["']/i,
      'href="./landing.css"',
    )
    .replace(
      [
        '<script\\s+type=["\']module["\']',
        '\\s+src=["\']\\/landing\\.ts["\']',
        '\\s*><\\/script>',
      ].join(''),
      [
        '<script type="module"',
        ' src="./devtools.landing.js">',
        '</script>',
      ].join(''),
    )
}

/**
 * Resolves monorepo package imports directly to workspace source files.
 *
 * This keeps the landing build independent from package publication state and
 * lets the Cipó/Fábrica compiler process the same source graph used elsewhere
 * in the repository.
 */
function workspaceAliasPlugin(): Plugin {
  return {
    name: 'workspace-alias',
    enforce: 'pre',

    async resolveId(id) {
      if (!id.startsWith('@rodkisten/')) {
        return null
      }

      const rest = id.slice(
        '@rodkisten/'.length,
      )

      const slash = rest.indexOf('/')

      const packageName =
        slash === -1
          ? rest
          : rest.slice(
              0,
              slash,
            )

      const subpath =
        slash === -1
          ? 'index'
          : rest.slice(
              slash + 1,
            )

      if (
        !(
          WORKSPACE_PACKAGES as readonly string[]
        ).includes(packageName)
      ) {
        return null
      }

      const candidates = workspaceSourceCandidates(
        packageName as (
          typeof WORKSPACE_PACKAGES
        )[number],
        subpath,
      )

      for (const candidate of candidates) {
        try {
          await fs.access(candidate)

          return candidate
        } catch {
          // Try the next supported workspace source candidate.
        }
      }

      return candidates[0] ?? null
    },
  }
}

/**
 * Builds the DevTools landing page through the shared Cipó/Fábrica Vite
 * compiler pipeline.
 *
 * The landing JavaScript is emitted as a native ES module rather than an IIFE.
 * Dynamic imports are inlined so Pages still receives one deterministic
 * `devtools.landing.js` entry.
 */
export async function buildDevtoolsLanding(
  options: BuildDevtoolsLandingOptions = {},
): Promise<string[]> {
  const sourceDirectory = path.join(
    ROOT_DIR,
    'devtools',
  )

  const outputDirectory =
    options.outputDirectory
    ?? DEVTOOLS_LANDING_DIR

  const htmlSource = path.join(
    sourceDirectory,
    'index.html',
  )

  const cssSource = path.join(
    sourceDirectory,
    'landing.css',
  )

  const scriptSource = path.join(
    sourceDirectory,
    'landing.ts',
  )

  const scriptOutput = path.join(
    outputDirectory,
    'devtools.landing.js',
  )

  const htmlOutput = path.join(
    outputDirectory,
    'index.html',
  )

  const cssOutput = path.join(
    outputDirectory,
    'landing.css',
  )

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  )

  await buildWithVite({
    configFile: false,
    root: ROOT_DIR,
    base: './',
    publicDir: false,

    plugins: [
      workspaceAliasPlugin(),

      cipoVite({
        mode: 'build',

        enabled: true,

        compileFabrica: true,

        transformCssTag: true,

        cssDelivery: 'style-tag',

        configCss:
          devtoolsCipoConfigCss,

        configRuntimeBindings: [
          'devtoolsCipoConfigCss',
        ],

        styledImportModules: [
          '@rodkisten/devtools/core/runtime',
        ],
      }),
    ],

    build: {
      outDir:
        outputDirectory,

      emptyOutDir:
        false,

      target: [
        'es2022',
        'safari16.4',
      ],

      minify:
        options.minify
        ?? true,

      sourcemap:
        options.sourcemap
        ?? true,

      cssCodeSplit:
        false,

      copyPublicDir:
        false,

      rollupOptions: {
        input:
          scriptSource,

        output: {
          format:
            'es',

          entryFileNames:
            'devtools.landing.js',

          chunkFileNames:
            'devtools.landing.[name].js',

          assetFileNames:
            'devtools.landing.[name][extname]',

          inlineDynamicImports:
            true,
        },
      },
    },
  })

  const html =
    createBuiltDevtoolsLandingHtml(
      await fs.readFile(
        htmlSource,
        'utf8',
      ),
    )

  await Promise.all([
    fs.copyFile(
      cssSource,
      cssOutput,
    ),

    fs.writeFile(
      htmlOutput,
      html,
      'utf8',
    ),
  ])

  const emitted = [
    htmlOutput,
    cssOutput,
    scriptOutput,
    `${scriptOutput}.map`,
  ]

  const existing = await Promise.all(
    emitted.map(
      async (file) => {
        try {
          await fs.access(file)

          return path.relative(
            DIST_DIR,
            file,
          )
        } catch {
          return null
        }
      },
    ),
  )

  return existing.filter(
    (
      file,
    ): file is string =>
      file !== null,
  )
}
