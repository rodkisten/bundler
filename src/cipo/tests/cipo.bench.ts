import { bench, beforeEach, describe } from 'vitest'
import { atomic, css, inline, sheet } from '../src/index'
import { invalidateCssConfigApplications } from '../src/config-css'
import { clearPolymorphicTemplateCache } from '../src/css'
import { clearPolymorphicDetectionCache } from '../src/compiler/detect-mode'
import { clearJitCaches } from '../src/runtime'
import { createAtomicClassName } from '../src/compiler/atomic-class-name'
import { createAtomicRuleId } from '../src/compiler/selector-compile'
import { compile as stylisCompile, serialize as stylisSerialize, stringify as stylisStringify } from 'stylis'
import {
  ATOMIC_CASE,
  CONFIG_CASE,
  INLINE_CASE,
  SHEET_CASE,
  setupBenchCipo,
  setupReadableClassBenchCipo,
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


describe('Cipó atomic class-name benchmarks', () => {
  const context = { breakpoint: 'md', pseudo: ':hover' } as const
  const ruleId = createAtomicRuleId('background-attachment', 'fixed', context)

  describe('compact production naming', () => {
    beforeEach(setupBenchCipo)

    bench('class name: compact prefix-a-hash', () => {
      createAtomicClassName('background-attachment', 'fixed', context, ruleId)
    })
  })

  describe('readable debug naming', () => {
    beforeEach(setupReadableClassBenchCipo)

    bench('class name: readable property-value-context-hash', () => {
      createAtomicClassName('background-attachment', 'fixed', context, ruleId)
    })

    bench('class name: privacy redaction and truncation', () => {
      createAtomicClassName(
        'background-image',
        'url("https://private.example/token/image.png")',
        context,
        createAtomicRuleId('background-image', 'url("https://private.example/token/image.png")', context),
      )
    })
  })
})


describe('Cipó competitor benchmarks: Stylis', () => {
  const stylisSheet = `
    .card {
      background: rgb(17 17 17 / .72);
      border: 1px solid rgb(255 255 255 / .12);
      backdrop-filter: blur(18px);
      padding-inline: 1rem;
      padding-block: .5rem;
    }

    .card .card-inner {
      display: flex;
      gap: 8px;
      color: #f97316;
      box-shadow: 0 16px 40px rgb(0 0 0 / .22);
    }

    .card:hover {
      background: rgb(249 115 22 / .72);
    }

    @media (min-width: 720px) {
      .card {
        grid-template-columns: 1fr 1fr;
      }
    }
  `

  bench('stylis: nested stylesheet compile', () => {
    stylisSerialize(stylisCompile(stylisSheet), stylisStringify)
  })

  bench('stylis: tiny declaration compile', () => {
    stylisSerialize(stylisCompile('.x{color:red;}'), stylisStringify)
  })
})
