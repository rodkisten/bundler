import { bench, beforeEach, describe } from 'vitest'
import { atomic, css, inline, sheet } from '../src/index'
import { invalidateCssConfigApplications } from '../src/config-css'
import { clearPolymorphicTemplateCache } from '../src/css'
import { clearPolymorphicDetectionCache } from '../src/compiler/detect-mode'
import { clearJitCaches } from '../src/runtime'
import {
  ATOMIC_CASE,
  CONFIG_CASE,
  INLINE_CASE,
  SHEET_CASE,
  setupBenchCipo,
} from './cipo.bench-cases'

function clearCompileColdPath(): void {
  clearJitCaches()
}

function clearPolymorphicColdPath(): void {
  clearCompileColdPath()
  clearPolymorphicTemplateCache()
  clearPolymorphicDetectionCache()
}

describe('Cipó warm-cache benchmarks', () => {
  beforeEach(setupBenchCipo)

  bench('baseline: String.raw tiny css', () => {
    String.raw`color:red;`
  })

  bench('warm atomic.css: classic atomic compile', () => {
    atomic.css`
      px: 4
      bg: $brand
      rounded: $xl
    `
  })

  bench('warm css: polymorphic atomic identity hit', () => {
    css`
      px: 4
      bg: $brand
      rounded: $xl
    `
  })

  bench('warm inline.css: inline style compile', () => {
    inline.css`${INLINE_CASE}`
  })

  bench('warm atomic.css: aliases helpers comments variants', () => {
    atomic.css`${ATOMIC_CASE}`
  })

  bench('warm sheet.css: nested sheet runtime DSL', () => {
    sheet.css`${SHEET_CASE}`
  })

  bench('warm css: polymorphic sheet identity hit', () => {
    css`${SHEET_CASE}`
  })

  bench('warm css: prepared configure plan hit', () => {
    css`${CONFIG_CASE}`
  })

  bench('warm sheet.css.withImportant', () => {
    sheet.css.withImportant`${SHEET_CASE}`
  })

  bench('warm atomic.css.withImportant', () => {
    atomic.css.withImportant`${ATOMIC_CASE}`
  })
})

describe('Cipó cold-path benchmarks', () => {
  beforeEach(setupBenchCipo)

  bench('cold atomic.css: transform parse compile', () => {
    clearCompileColdPath()
    atomic.css`${ATOMIC_CASE}`
  })

  bench('cold sheet.css: transform parse compile', () => {
    clearCompileColdPath()
    sheet.css`${SHEET_CASE}`
  })

  bench('cold css: atomic detection + compile', () => {
    clearPolymorphicColdPath()
    css`${ATOMIC_CASE}`
  })

  bench('cold css: sheet detection + compile', () => {
    clearPolymorphicColdPath()
    css`${SHEET_CASE}`
  })

  bench('cold css: configure parse + normalized apply', () => {
    clearPolymorphicColdPath()
    invalidateCssConfigApplications({ clearPlans: true })
    css`${CONFIG_CASE}`
  })
})
