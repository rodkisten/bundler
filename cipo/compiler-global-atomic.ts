import { collectRules } from '@rodkisten/cipo/compiler-at-rules'
import { compileCss } from '@rodkisten/cipo/compiler-sheet-compile'
import { optimizeCompiledCss } from '@rodkisten/cipo/compiler-compiled-css-optimizer'
import { resolveScopedSelector } from '@rodkisten/cipo/compiler-selector-compile'
import { configureFromCss } from '@rodkisten/cipo/config-css'
import { parseStylesheet } from '@rodkisten/cipo/parser'
import { runtime } from '@rodkisten/cipo/runtime'
import { transformCss } from '@rodkisten/cipo/transform'
import type { CipoAtomicRule, CipoDeclarationNode, CipoScopedRule, CipoWarning } from '@rodkisten/cipo/types'
import { hashString } from '@rodkisten/cipo/utils'

/** One statically compiled component/declaration style waiting for whole-build promotion. */
export interface CipoGlobalAtomicStyleInput {
  /** Stable build entry id. */
  readonly key: string
  /** Temporary class emitted by the source transform and replaced during renderChunk. */
  readonly className: string
  readonly rawCss: string
  readonly filename?: string
  readonly receiver?: string
}

export interface CipoGlobalAtomicCompileOptions {
  /** CSS-first configuration applied before global analysis. */
  readonly configCss?: string
  /** Overrides the CSS-first atomic threshold for low-level tooling only. */
  readonly minUses?: number
}

export interface CipoGlobalAtomicCompileResult {
  /** One consolidated stylesheet for every analyzed component. */
  readonly css: string
  /** Temporary source class -> final scope/atomic class list. */
  readonly classNames: ReadonlyMap<string, string>
  readonly minUses: number
  readonly minifiedClassNames: boolean
}

type AtomicPlan = {
  readonly input: CipoGlobalAtomicStyleInput
  readonly scopeClassName: string
  readonly atoms: readonly CipoAtomicRule[]
  readonly scopedRules: readonly CipoScopedRule[]
}

/**
 * Performs whole-build atomic promotion for static Cipó/Fábrica Elements styles.
 *
 * @remarks
 * The source transform intentionally does not embed component CSS. Instead every
 * static style is collected here, declarations are counted across the complete
 * module graph, and only declarations reaching `atomic.minUses` become shared
 * atomic classes. One-off declarations stay under the component scope class.
 *
 * This is the build-time equivalent of Cipó's runtime promotion policy, but it
 * can also rewrite earlier components because the complete usage graph is known.
 */
export function compileGlobalAtomicStyles(
  inputs: readonly CipoGlobalAtomicStyleInput[],
  options: CipoGlobalAtomicCompileOptions = {},
): CipoGlobalAtomicCompileResult {
  if (options.configCss) configureFromCss(options.configCss)

  const minUses = normalizeMinUses(options.minUses ?? runtime.config.atomic.minUses)
  const minifiedClassNames = !runtime.config.debug || !runtime.config.debugOptions.readableClassNames
  const plans: AtomicPlan[] = []
  const usageCounts = new Map<string, number>()

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index]!
    const warnings: CipoWarning[] = []
    const transformedCss = transformCss(input.rawCss, warnings)
    const ast = parseStylesheet(transformedCss, warnings)
    const scopeClassName = createScopeClassName(input, minifiedClassNames)
    const collected = collectRules(ast, scopeClassName, warnings)
    const atoms = normalizeAtomClassNames(collected.atoms, minifiedClassNames)
    const uniqueIds = new Set<string>()

    for (let atomIndex = 0; atomIndex < atoms.length; atomIndex += 1) {
      const atom = atoms[atomIndex]!
      if (uniqueIds.has(atom.id)) continue
      uniqueIds.add(atom.id)
      usageCounts.set(atom.id, (usageCounts.get(atom.id) ?? 0) + 1)
    }

    plans.push({
      input,
      scopeClassName,
      atoms,
      scopedRules: collected.scopedRules,
    })
  }

  const promotedById = new Map<string, CipoAtomicRule>()
  const allScopedRules: CipoScopedRule[] = []
  const classNames = new Map<string, string>()

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index]!
    const uniqueAtoms = uniqueAtomsById(plan.atoms)
    const promotedForComponent: CipoAtomicRule[] = []
    const fallbackRules: CipoScopedRule[] = []

    for (let atomIndex = 0; atomIndex < uniqueAtoms.length; atomIndex += 1) {
      const atom = uniqueAtoms[atomIndex]!
      const promoted = (usageCounts.get(atom.id) ?? 0) >= minUses

      if (promoted) {
        promotedById.set(atom.id, atom)
        promotedForComponent.push(atom)
        continue
      }

      fallbackRules.push({
        selector: resolveScopedSelector(plan.scopeClassName, '', atom.context),
        declarations: [atomToDeclaration(atom)],
        context: atom.context,
      })
    }

    allScopedRules.push(...fallbackRules, ...plan.scopedRules)

    const needsScope = fallbackRules.length > 0 || plan.scopedRules.length > 0
    classNames.set(
      plan.input.className,
      joinClassNames(needsScope ? plan.scopeClassName : '', promotedForComponent),
    )
  }

  const css = optimizeCompiledCss(
    compileCss(Array.from(promotedById.values()), allScopedRules),
    {
      minify: runtime.config.minify,
      mergeEquivalentRules: true,
    },
  )

  return {
    css,
    classNames,
    minUses,
    minifiedClassNames,
  }
}

function normalizeMinUses(value: number): number {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY
  return Math.max(1, Math.trunc(value))
}

function createScopeClassName(
  input: CipoGlobalAtomicStyleInput,
  minified: boolean,
): string {
  const hash = hashString(`${input.filename ?? ''}|${input.receiver ?? ''}|${input.rawCss}`)
  if (minified) return `s${hash}`

  const rawLabel = input.receiver?.match(/['"]([^'"]+)['"]/)?.[1] ?? ''
  const label = sanitizeLabel(rawLabel)
  return label
    ? `${runtime.config.prefix}-${label}-${hash}`
    : `${runtime.config.prefix}-scope-${hash}`
}

function normalizeAtomClassNames(
  atoms: readonly CipoAtomicRule[],
  minified: boolean,
): readonly CipoAtomicRule[] {
  if (!minified) return atoms
  return atoms.map((atom) => ({ ...atom, className: `a${hashString(atom.id)}` }))
}

function uniqueAtomsById(atoms: readonly CipoAtomicRule[]): CipoAtomicRule[] {
  const seen = new Set<string>()
  const output: CipoAtomicRule[] = []
  for (let index = 0; index < atoms.length; index += 1) {
    const atom = atoms[index]!
    if (seen.has(atom.id)) continue
    seen.add(atom.id)
    output.push(atom)
  }
  return output
}

function atomToDeclaration(atom: CipoAtomicRule): CipoDeclarationNode {
  return {
    type: 'declaration',
    property: atom.property,
    value: atom.value,
    source: atom.source,
  }
}

function joinClassNames(scopeClassName: string, atoms: readonly CipoAtomicRule[]): string {
  const output: string[] = []
  const seen = new Set<string>()
  if (scopeClassName) {
    output.push(scopeClassName)
    seen.add(scopeClassName)
  }
  for (let index = 0; index < atoms.length; index += 1) {
    const className = atoms[index]!.className
    if (seen.has(className)) continue
    seen.add(className)
    output.push(className)
  }
  return output.join(' ')
}

function sanitizeLabel(value: string): string {
  return String(value || '')
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}
