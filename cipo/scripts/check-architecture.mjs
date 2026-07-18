import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entrypoints = [
  'index.ts',
  'browser-entry.ts',
  'compiler.ts',
  'vite-index.ts',
  'compiled-runtime.ts',
]
const legacyFiles = [
  'compiler-index.ts',
  'compiler-source.ts',
  'compiler-safe-atomic-compile.ts',
  'compiler-safe-inline-compile.ts',
  'compiler-safe-inline-text.ts',
  'compiler-safe-sheet-compile.ts',
  'safe-inline-artifact.ts',
  'config-result-kind-compat.ts',
  'safe-atomic.ts',
  'safe-inline.ts',
  'safe-sheet.ts',
  'safe-css.ts',
  'vite-compiled-inline.ts',
  'compact-block-safety.ts',
  'core-size-safety.ts',
  'core-transform-safety.ts',
  'native-slash-protection.ts',
  'property-directive-safety.ts',
  'remaining-runtime-vars.ts',
  'restore-native-slash.ts',
  'selector-list-safety.ts',
  'safe-source.ts',
  'safe-template.ts',
  'prepare-core-css.ts',
  'compiler/at-rule-kinds.ts',
  'compiler/at-rules.ts',
  'compiler/cache.ts',
  'compiler/declaration.ts',
  'compiler/diagnostics.ts',
  'compiler/emitter.ts',
  'compiler/hash-registry.ts',
  'compiler/important.ts',
  'compiler/ir.ts',
  'compiler/optimizer.ts',
  'compiler/pseudos.ts',
  'compiler/selector.ts',
  'compiler/atomic/class-name.ts',
  'compiler/atomic/compile.ts',
  'compiler/atomic/rule.ts',
  'compiler/atomic/runtime.ts',
  'compiler/atomic/utils.ts',
  'compiler/inline/compile.ts',
  'compiler/stylesheet/compile.ts',
  'compiler/stylesheet/emitter.ts',
  'compiler/stylesheet/format.ts',
  'compiler/stylesheet/selectors.ts',
]

function walk(directory) {
  const output = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['dist', 'node_modules', 'test', 'scripts', 'examples'].includes(entry.name)) continue
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) output.push(...walk(absolute))
    else if (entry.isFile() && extname(entry.name) === '.ts' && !entry.name.endsWith('.test.ts')) output.push(absolute)
  }
  return output
}

function extractModuleSpecifiers(source, filename) {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const modules = new Set()

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) modules.add(node.moduleSpecifier.text)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments
      if (argument && ts.isStringLiteralLike(argument)) modules.add(argument.text)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...modules]
}

function resolveLocalImport(fromFile, specifier, fileSet) {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [base, `${base}.ts`, join(base, 'index.ts')]
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null
}

function buildGraph(files) {
  const fileSet = new Set(files)
  const graph = new Map()
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const dependencies = extractModuleSpecifiers(source, file)
      .map((specifier) => resolveLocalImport(file, specifier, fileSet))
      .filter(Boolean)
    graph.set(file, [...new Set(dependencies)])
  }
  return graph
}

function findCycles(graph) {
  const indexByNode = new Map()
  const lowLink = new Map()
  const stack = []
  const onStack = new Set()
  const cycles = []
  let index = 0

  function visit(node) {
    indexByNode.set(node, index)
    lowLink.set(node, index)
    index += 1
    stack.push(node)
    onStack.add(node)

    for (const next of graph.get(node) ?? []) {
      if (!indexByNode.has(next)) {
        visit(next)
        lowLink.set(node, Math.min(lowLink.get(node), lowLink.get(next)))
      } else if (onStack.has(next)) {
        lowLink.set(node, Math.min(lowLink.get(node), indexByNode.get(next)))
      }
    }

    if (lowLink.get(node) !== indexByNode.get(node)) return
    const component = []
    let current
    do {
      current = stack.pop()
      onStack.delete(current)
      component.push(current)
    } while (current !== node)

    const selfCycle = component.length === 1 && (graph.get(component[0]) ?? []).includes(component[0])
    if (component.length > 1 || selfCycle) cycles.push(component)
  }

  for (const node of graph.keys()) if (!indexByNode.has(node)) visit(node)
  return cycles
}

function collectReachable(graph, roots) {
  const reached = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const node = queue.pop()
    if (!node || reached.has(node)) continue
    reached.add(node)
    queue.push(...(graph.get(node) ?? []))
  }
  return reached
}

function fail(messages) {
  for (const message of messages) console.error(`[cipo:architecture] ${message}`)
  process.exitCode = 1
}

const errors = []
const files = walk(packageRoot)
const graph = buildGraph(files)
const cycles = findCycles(graph)
if (cycles.length > 0) {
  for (const cycle of cycles) {
    errors.push(`dependency cycle: ${cycle.map((file) => relative(packageRoot, file)).join(' -> ')}`)
  }
}

const rootFiles = entrypoints.map((entry) => resolve(packageRoot, entry))
for (const root of rootFiles) {
  if (!existsSync(root)) errors.push(`missing public entrypoint: ${relative(packageRoot, root)}`)
}
const reachable = collectReachable(graph, rootFiles.filter((file) => existsSync(file)))
const unreachable = files.filter((file) => !reachable.has(file))
for (const file of unreachable) errors.push(`unreachable production module: ${relative(packageRoot, file)}`)

const rootIndexPath = resolve(packageRoot, 'index.ts')
const rootIndex = readFileSync(rootIndexPath, 'utf8')
for (const forbidden of ['./compiler', './integrations/vite', 'typescript', "from 'vite'", 'from "vite"']) {
  if (rootIndex.includes(forbidden)) errors.push(`root runtime entrypoint references toolchain dependency: ${forbidden}`)
}

// The runtime/compiler split is transitive, not merely an entry-file convention.
// Any compiler or Vite module reachable from the normal runtime entrypoint would
// pull build tooling back into browser graphs even if index.ts itself looked clean.
const runtimeReachable = collectReachable(graph, [rootIndexPath])
for (const file of runtimeReachable) {
  const modulePath = relative(packageRoot, file)
  if (modulePath.startsWith('compiler/') || modulePath.startsWith('integrations/')) {
    errors.push(`runtime entrypoint reaches build-tool module: ${modulePath}`)
  }
}

// Shared engine code may be consumed by runtime and compiler, but it must never
// depend upward on build tooling. This keeps the dependency direction explicit:
// syntax/transform/runtime -> engine <- compiler/integrations.
for (const [file, dependencies] of graph) {
  const modulePath = relative(packageRoot, file)
  if (!modulePath.startsWith('engine/')) continue
  for (const dependency of dependencies) {
    const dependencyPath = relative(packageRoot, dependency)
    if (dependencyPath.startsWith('compiler/') || dependencyPath.startsWith('integrations/')) {
      errors.push(`engine module depends on build-tool module: ${modulePath} -> ${dependencyPath}`)
    }
  }
}

const workspaceTsconfig = JSON.parse(readFileSync(resolve(packageRoot, '..', 'tsconfig.base.json'), 'utf8'))
const workspacePaths = workspaceTsconfig.compilerOptions?.paths ?? {}
if (Object.hasOwn(workspacePaths, '@rodkisten/cipo/*')) errors.push('workspace tsconfig must not bypass package exports with @rodkisten/cipo/*')

const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))
const exportKeys = Object.keys(packageJson.exports ?? {})
if (exportKeys.some((key) => key.includes('*'))) errors.push('package exports must not expose wildcard/internal subpaths')

for (const legacy of legacyFiles) {
  if (existsSync(resolve(packageRoot, legacy))) errors.push(`legacy module must stay deleted: ${legacy}`)
}

const topLevelCompilerInternals = files
  .map((file) => relative(packageRoot, file))
  .filter((file) => /^compiler-.+\.ts$/.test(file))
for (const file of topLevelCompilerInternals) errors.push(`compiler internal escaped compiler/ boundary: ${file}`)

if (errors.length > 0) fail(errors)
else console.log(`[cipo:architecture] OK: ${files.length} production modules, 0 cycles, 0 unreachable modules.`)
