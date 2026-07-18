import { installBuiltInAliases } from '../../aliases'
import { collectRules } from '../../engine/at-rules'
import { optimizeCompiledCss } from '../../engine/optimizer'
import { resolveScopedSelector } from '../../engine/selector'
import { atomicRuleToDeclaration, joinAtomicClassNames, normalizeAtomicMinUses } from '../../engine/atomic/utils'
import { createCompilerContext, runInCompilerContext } from '../context'
import { compileCss } from '../../engine/emitter'
import { assertGeneratedNameIdentity } from '../../engine/hash-registry'
import { configureFromCss } from '../../config-css'
import { installBuiltInHelpers } from '../../helpers'
import { installNativePropertyGuards } from '../../native-property-guards'
import { parseStylesheet } from '../../syntax/parser'
import { runtime } from '../../runtime'
import { transformCss } from '../../transform/index'
import type { CipoAtomicRule, CipoScopedRule, CipoWarning } from '../../types'
import { hashString64 } from '../../utils'

/** One statically compiled component/declaration style waiting for whole-build promotion. */
export interface CipoGlobalAtomicStyleInput {
  readonly key: string
  readonly className: string
  readonly rawCss: string
  readonly filename?: string
  readonly receiver?: string
}

export interface CipoGlobalAtomicCompileOptions {
  readonly configCss?: string
  readonly minUses?: number
  /** Short salt used to isolate compact classes emitted by independent bundles. */
  readonly buildNamespace?: string
}

export interface CipoGlobalAtomicCompileResult {
  readonly css: string
  readonly classNames: ReadonlyMap<string, string>
  readonly minUses: number
  readonly minifiedClassNames: boolean
  /** Effective compiler minification mode after applying compile-time CSS configuration. */
  readonly minifyCss: boolean
}

type AtomicPlan = {
  readonly input: CipoGlobalAtomicStyleInput
  readonly scopeClassName: string
  readonly atoms: readonly CipoAtomicRule[]
  readonly scopedRules: readonly CipoScopedRule[]
}

/** Performs deterministic whole-build atomic promotion in an isolated compiler session. */
export function compileGlobalAtomicStyles(
  inputs: readonly CipoGlobalAtomicStyleInput[],
  options: CipoGlobalAtomicCompileOptions = {},
): CipoGlobalAtomicCompileResult {
  const context = createCompilerContext({ id: 'global-atomic' })
  return runInCompilerContext(context, () => {
    installBuiltInHelpers()
    installBuiltInAliases()
    installNativePropertyGuards()
    if (options.configCss) configureFromCss(options.configCss)
    return compileGlobalAtomicStylesInContext(inputs, options)
  })
}

function compileGlobalAtomicStylesInContext(
  inputs: readonly CipoGlobalAtomicStyleInput[],
  options: CipoGlobalAtomicCompileOptions,
): CipoGlobalAtomicCompileResult {
  const minUses = normalizeAtomicMinUses(options.minUses ?? runtime.config.atomic.minUses)
  const minifiedClassNames = !runtime.config.debug || !runtime.config.debugOptions.readableClassNames
  const namespace = sanitizeNamespace(options.buildNamespace ?? runtime.config.prefix)
  const plans: AtomicPlan[] = []
  const usageCounts = new Map<string, number>()

  for (const input of inputs) {
    const warnings: CipoWarning[] = []
    const transformedCss = transformCss(input.rawCss, warnings)
    const ast = parseStylesheet(transformedCss, warnings)
    const scopeClassName = createScopeClassName(input, minifiedClassNames, namespace)
    const collected = collectRules(ast, scopeClassName, warnings)
    const atoms = normalizeAtomClassNames(collected.atoms, minifiedClassNames, namespace)
    const uniqueIds = new Set<string>()

    for (const atom of atoms) {
      if (uniqueIds.has(atom.id)) continue
      uniqueIds.add(atom.id)
      usageCounts.set(atom.id, (usageCounts.get(atom.id) ?? 0) + 1)
    }

    plans.push({ input, scopeClassName, atoms, scopedRules: collected.scopedRules })
  }

  const promotedById = new Map<string, CipoAtomicRule>()
  const allScopedRules: CipoScopedRule[] = []
  const classNames = new Map<string, string>()

  for (const plan of plans) {
    const uniqueAtoms = uniqueAtomsById(plan.atoms)
    const promotedForComponent: CipoAtomicRule[] = []
    const fallbackRules: CipoScopedRule[] = []

    for (const atom of uniqueAtoms) {
      const promoted = (usageCounts.get(atom.id) ?? 0) >= minUses
      if (promoted) {
        promotedById.set(atom.id, atom)
        promotedForComponent.push(atom)
        continue
      }

      fallbackRules.push({
        selector: resolveScopedSelector(plan.scopeClassName, '', atom.context),
        declarations: [atomicRuleToDeclaration(atom)],
        context: atom.context,
      })
    }

    allScopedRules.push(...fallbackRules, ...plan.scopedRules)
    const needsScope = fallbackRules.length > 0 || plan.scopedRules.length > 0
    classNames.set(
      plan.input.className,
      joinAtomicClassNames(needsScope ? plan.scopeClassName : '', promotedForComponent),
    )
  }

  const css = optimizeCompiledCss(
    compileCss(Array.from(promotedById.values()), allScopedRules),
    {
      minify: runtime.config.minify,
      mergeEquivalentRules: true,
    },
  )

  return { css, classNames, minUses, minifiedClassNames, minifyCss: runtime.config.minify }
}

function createScopeClassName(
  input: CipoGlobalAtomicStyleInput,
  minified: boolean,
  namespace: string,
): string {
  const identity = `${namespace}|${input.filename ?? ''}|${input.receiver ?? ''}|${input.rawCss}`
  const hash = hashString64(identity)
  const rawLabel = input.receiver?.match(/['"]([^'"]+)['"]/)?.[1] ?? ''
  const label = sanitizeLabel(rawLabel)
  const className = minified
    ? `s${namespace}${hash}`
    : label
      ? `${runtime.config.prefix}-${label}-${hash}`
      : `${runtime.config.prefix}-scope-${hash}`
  assertGeneratedNameIdentity(className, `global-scope|${identity}`)
  return className
}

function normalizeAtomClassNames(
  atoms: readonly CipoAtomicRule[],
  minified: boolean,
  namespace: string,
): readonly CipoAtomicRule[] {
  if (!minified) return atoms
  return atoms.map((atom) => {
    const className = `a${namespace}${hashString64(atom.id)}`
    assertGeneratedNameIdentity(className, `global-atom|${atom.id}`)
    return { ...atom, className }
  })
}

function uniqueAtomsById(atoms: readonly CipoAtomicRule[]): CipoAtomicRule[] {
  const seen = new Set<string>()
  const output: CipoAtomicRule[] = []
  for (const atom of atoms) {
    if (seen.has(atom.id)) continue
    seen.add(atom.id)
    output.push(atom)
  }
  return output
}

function sanitizeLabel(value: string): string {
  return String(value || '')
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sanitizeNamespace(value: string): string {
  const normalized = String(value || 'c').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8)
  return normalized || 'c'
}
