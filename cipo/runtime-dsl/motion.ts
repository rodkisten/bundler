import { MOTION_PRESETS } from '../values/presets'
import { findTopLevelColon, splitTopLevel } from '../utils'
import type { CipoWarning } from '../types'
import {
  findMatching,
  isEscapedAt,
  isIdentifierPart,
  skipSpaces,
} from './shared'

interface MotionTransition {
  readonly property: string
  readonly from: string
  readonly to: string
}

/** Expands motion(...) declaration helpers into transition + starting-style. */
export function expandRuntimeMotion(
  input: string,
  warnings: CipoWarning[],
): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const start = findMotionCall(input, index)
    if (start < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, start)
    const open = skipSpaces(input, start + 'motion'.length)
    const close = findMatching(input, open, '(', ')')
    if (close < 0) {
      warnings.push({
        code: 'cipo-motion-unclosed',
        message: 'Unclosed runtime motion(...) call.',
      })
      output += input.slice(start)
      break
    }

    const rendered = renderMotion(input.slice(open + 1, close), warnings)
    output += rendered
    index = close + 1
  }

  return output
}

function renderMotion(
  rawArgs: string,
  warnings: CipoWarning[],
): string {
  const args = resolveMotionPreset(rawArgs)
  const transitions: MotionTransition[] = []
  const options = new Map<string, string>()

  for (const part of splitTopLevel(args, ',')) {
    const colon = findTopLevelColon(part)
    if (colon <= 0) continue

    const key = part.slice(0, colon).trim().toLowerCase()
    const value = part.slice(colon + 1).trim()
    const arrow = findTopLevelArrow(value)

    if (arrow >= 0) {
      const from = value.slice(0, arrow).trim()
      const to = value.slice(arrow + 2).trim()
      if (from && to) {
        transitions.push({ property: key, from, to })
      }
      continue
    }

    options.set(key, value)
  }

  if (transitions.length === 0) {
    warnings.push({
      code: 'cipo-motion-empty',
      message: 'motion() needs at least one `property: from -> to` pair.',
    })
    return ''
  }

  const duration = options.get('duration') || '180ms'
  const easing = options.get('easing') || 'ease-out'
  const delay = options.get('delay') || '0ms'
  const reduce = options.get('reduce') !== 'false'
  const final = renderMotionDeclarations(transitions, 'to')
  const initial = renderMotionDeclarations(transitions, 'from')
  const properties = transitions
    .map((item) => normalizeMotionProperty(item.property))
    .filter(Boolean)

  let output = final ? `${final}\n` : ''
  output += `transition-property: ${Array.from(new Set(properties)).join(', ')}`
  output += `\ntransition-duration: ${duration}`
  output += `\ntransition-timing-function: ${easing}`
  if (delay !== '0ms' && delay !== '0') {
    output += `\ntransition-delay: ${delay}`
  }
  output += `\nstarting-style {${initial}}`

  if (reduce) {
    output += [
      '\nreduce-motion {',
      'transition-duration: 0ms',
      'transition-delay: 0ms',
      '}',
    ].join('\n')
  }

  return output
}

function renderMotionDeclarations(
  transitions: readonly MotionTransition[],
  side: 'from' | 'to',
): string {
  const declarations: string[] = []
  let x: string | undefined
  let y: string | undefined

  for (const transition of transitions) {
    const value = transition[side]
    if (transition.property === 'x') {
      x = value
      continue
    }
    if (transition.property === 'y') {
      y = value
      continue
    }

    declarations.push(
      `${normalizeMotionProperty(transition.property)}: ${value}`,
    )
  }

  if (x !== undefined || y !== undefined) {
    declarations.push(`translate: ${x || '0'} ${y || '0'}`)
  }

  return declarations.join('\n')
}

function normalizeMotionProperty(property: string): string {
  if (property === 'x' || property === 'y') return 'translate'
  return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function resolveMotionPreset(input: string): string {
  const trimmed = input.trim()
  if (!/^\$[a-zA-Z][\w-]*$/.test(trimmed)) return input
  return MOTION_PRESETS[trimmed.slice(1)] || input
}

function findTopLevelArrow(input: string): number {
  let quote: string | null = null
  let depth = 0

  for (let index = 0; index < input.length - 1; index += 1) {
    const char = input[index] ?? ''
    if (quote) {
      if (char === quote && !isEscapedAt(input, index)) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    else if (
      depth === 0
      && char === '-'
      && input[index + 1] === '>'
    ) {
      return index
    }
  }

  return -1
}

function findMotionCall(input: string, startIndex: number): number {
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (char === quote && !isEscapedAt(input, index)) quote = null
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (!input.startsWith('motion', index)) continue
    const before = input[index - 1] ?? ''
    const after = input[index + 'motion'.length] ?? ''
    if (
      (before && isIdentifierPart(before))
      || (after && isIdentifierPart(after))
    ) {
      continue
    }

    const open = skipSpaces(input, index + 'motion'.length)
    if (input[open] === '(') return index
  }

  return -1
}
