import { runtime } from '../../runtime'
import type { CipoRuleContext } from '../../types'
import { hashString64 } from '../../utils'
import { assertGeneratedNameIdentity } from '../hash-registry'

/**
 * Creates the public class name for an atomic rule.
 *
 * @remarks
 * Production mode keeps the compact historic shape (`prefix-a-hash`). Debug
 * mode produces a deterministic, readable label followed by the same stable
 * hash. The hash is intentionally not random: stable names preserve cache hits,
 * snapshots, hydration and reproducible bug reports.
 */
export function createAtomicClassName(
  property: string,
  value: string,
  context: CipoRuleContext,
  ruleId: string,
): string {
  const hash = hashString64(ruleId)
  const config = runtime.config

  const className = !config.debug || !config.debugOptions.readableClassNames
    ? `${config.prefix}-a-${hash}`
    : `${config.prefix}-${createReadableAtomicLabel(property, value, context) || 'atomic'}-${hash}`

  assertGeneratedNameIdentity(className, ruleId)
  return className
}

/**
 * Builds a privacy-conscious human label from the resolved declaration.
 *
 * @remarks
 * URLs and quoted strings are redacted before normalization. This avoids
 * leaking tokens, data URLs or user-authored content into DevTools class names.
 * The final hash still identifies the exact declaration and context.
 */
export function createReadableAtomicLabel(
  property: string,
  value: string,
  context: CipoRuleContext,
): string {
  const options = runtime.config.debugOptions
  const contextSegments: string[] = []
  if (options.includeContext) appendContextSegments(contextSegments, context)

  const declarationSegments: string[] = []
  const propertySegment = sanitizeAtomicClassSegment(property, false)
  const valueSegment = sanitizeAtomicClassSegment(redactSensitiveCssValue(value), true)
  if (propertySegment) declarationSegments.push(propertySegment)
  if (valueSegment) declarationSegments.push(valueSegment)

  const contextLabel = normalizeReadableLabel(contextSegments.join('-'))
  const declarationLabel = normalizeReadableLabel(declarationSegments.join('-'))
  return composeReadableLabel(contextLabel, declarationLabel, options.maxClassLabelLength)
}

/** Normalizes arbitrary CSS text into a class-safe lowercase segment. */
export function sanitizeAtomicClassSegment(value: string, isValue = false): string {
  let output = String(value || '').trim().toLowerCase()
  if (!output) return ''

  output = output
    .replace(/\s*!important\s*$/i, '')
    .replace(/var\(\s*--([a-z0-9_-]+)(?:\s*,[^)]*)?\)/gi, 'var-$1')
    .replace(/^-([0-9])/, 'negative-$1')
    .replace(/%/g, '-pct-')
    .replace(/#/g, '-hex-')
    .replace(/\+/g, '-plus-')
    .replace(/\*/g, '-times-')
    .replace(/\//g, '-per-')
    .replace(/\./g, '-dot-')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/_{2,}/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')

  if (isValue && output.length === 0) return 'value'
  return output
}

function appendContextSegments(output: string[], context: CipoRuleContext): void {
  if (context.dark) output.push('dark')
  if (context.breakpoint && context.breakpoint !== 'base') {
    output.push(sanitizeAtomicClassSegment(context.breakpoint))
  } else if (context.mediaQuery) {
    const media = sanitizeAtomicClassSegment(context.mediaQuery)
    output.push(media ? `media-${media}` : 'media')
  }
  if (context.notBreakpoint) output.push(`not-${sanitizeAtomicClassSegment(context.notBreakpoint)}`)
  if (context.pseudo) output.push(sanitizeAtomicClassSegment(context.pseudo.replace(/^:+/, '')))
  if (context.supports) {
    const supports = sanitizeAtomicClassSegment(context.supports)
    output.push(supports ? `supports-${supports}` : 'supports')
  }
  if (context.container) {
    const container = sanitizeAtomicClassSegment(context.container)
    output.push(container ? `container-${container}` : 'container')
  }
  if (context.layer) {
    output.push(`layer-${sanitizeAtomicClassSegment(String(context.layer))}`)
  }
  if (context.startingStyle) output.push('starting-style')
}

function redactSensitiveCssValue(value: string): string {
  const trimmed = value.trim()
  if (/^(?:data|blob):/i.test(trimmed)) return 'url'

  return value
    .replace(/url\(\s*(['"]?)[\s\S]*?\1\s*\)/gi, 'url')
    .replace(/(?:data|blob):[^\s)]+/gi, 'url')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, 'string')
}

function normalizeReadableLabel(value: string): string {
  return value.replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
}

/** Keeps declaration identity visible even when verbose context consumes the label budget. */
function composeReadableLabel(context: string, declaration: string, maxLength: number): string {
  if (!context) return truncateReadableLabel(declaration, maxLength)
  if (!declaration) return truncateReadableLabel(context, maxLength)

  const full = `${context}-${declaration}`
  if (full.length <= maxLength) return full
  if (declaration.length >= maxLength) return truncateReadableLabel(declaration, maxLength)

  const contextBudget = Math.max(0, maxLength - declaration.length - 1)
  const contextPrefix = truncateReadableLabel(context, contextBudget)
  return contextPrefix ? `${contextPrefix}-${declaration}` : declaration
}

function truncateReadableLabel(value: string, maxLength: number): string {
  if (maxLength <= 0) return ''
  if (value.length <= maxLength) return value
  const truncated = value.slice(0, maxLength).replace(/-+$/g, '')
  return truncated || value.slice(0, maxLength)
}
