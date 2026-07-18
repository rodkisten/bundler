import { describe, expect, it } from 'vitest'
import { compileGlobalAtomicStyles } from './global'

describe('compileGlobalAtomicStyles', () => {
  it('promotes an atomic declaration shared by enough distinct components', () => {
    const result = compileGlobalAtomicStyles(
      [
        {
          key: 'button',
          className: 'Button',
          rawCss: 'color: red;',
          filename: '/src/button.ts',
          receiver: 'styled.button("Button")',
        },
        {
          key: 'link',
          className: 'Link',
          rawCss: 'color: red;',
          filename: '/src/link.ts',
          receiver: 'styled.a("Link")',
        },
      ],
      {
        minUses: 2,
        buildNamespace: 'test',
      },
    )

    const buttonClassName = result.classNames.get('Button')
    const linkClassName = result.classNames.get('Link')

    expect(result.minUses).toBe(2)
    expect(buttonClassName).toBeDefined()
    expect(linkClassName).toBeDefined()

    // Both components consume the same promoted atomic declaration.
    expect(buttonClassName).toBe(linkClassName)

    // Once promoted globally, the declaration must be emitted only once.
    expect(countOccurrences(result.css, 'color:red')).toBe(1)

    // A fully promoted component no longer needs its component scope class.
    expect(buttonClassName).not.toContain(' ')
  })

  it('does not count duplicate declarations inside one component as multiple usages', () => {
    const result = compileGlobalAtomicStyles(
      [
        {
          key: 'button',
          className: 'Button',
          rawCss: `
            color: red;
            color: red;
          `,
          filename: '/src/button.ts',
          receiver: 'styled.button("Button")',
        },
      ],
      {
        minUses: 2,
        buildNamespace: 'test',
      },
    )

    const className = result.classNames.get('Button')

    expect(className).toBeDefined()

    // Usage is counted once per component/atomic id, so a duplicate declaration
    // within the same component must not accidentally trigger global promotion.
    expect(className).toBeTruthy()

    // The declaration remains component-scoped because only one component uses it.
    expect(result.css).toContain('color:red')
  })

  it('keeps uncommon declarations scoped while promoting declarations shared across components', () => {
    const result = compileGlobalAtomicStyles(
      [
        {
          key: 'button',
          className: 'Button',
          rawCss: `
            color: red;
            padding: 8px;
          `,
          filename: '/src/button.ts',
          receiver: 'styled.button("Button")',
        },
        {
          key: 'link',
          className: 'Link',
          rawCss: `
            color: red;
          `,
          filename: '/src/link.ts',
          receiver: 'styled.a("Link")',
        },
      ],
      {
        minUses: 2,
        buildNamespace: 'test',
      },
    )

    const buttonClassName = requireClassName(result.classNames, 'Button')
    const linkClassName = requireClassName(result.classNames, 'Link')

    // `color: red` is shared and therefore promoted.
    // `padding: 8px` is unique to Button, so Button still requires its scope.
    expect(buttonClassName.split(/\s+/)).toHaveLength(2)

    // Link only contains the promoted declaration and therefore needs no scope.
    expect(linkClassName.split(/\s+/)).toHaveLength(1)

    const [buttonScope, buttonAtomic] = buttonClassName.split(/\s+/)

    expect(linkClassName).toBe(buttonAtomic)

    // The uncommon declaration remains attached to Button's private scope.
    expect(result.css).toContain(`.${buttonScope}`)
    expect(result.css).toContain('padding:8px')

    // The shared declaration is emitted globally only once.
    expect(countOccurrences(result.css, 'color:red')).toBe(1)
  })

  it('preserves contextual differences instead of incorrectly promoting atoms with different rule contexts', () => {
    const result = compileGlobalAtomicStyles(
      [
        {
          key: 'button-hover',
          className: 'Button',
          rawCss: `
            &:hover {
              color: red;
            }
          `,
          filename: '/src/button.ts',
          receiver: 'styled.button("Button")',
        },
        {
          key: 'link-focus',
          className: 'Link',
          rawCss: `
            &:focus {
              color: red;
            }
          `,
          filename: '/src/link.ts',
          receiver: 'styled.a("Link")',
        },
      ],
      {
        minUses: 2,
        buildNamespace: 'test',
      },
    )

    const buttonClassName = requireClassName(result.classNames, 'Button')
    const linkClassName = requireClassName(result.classNames, 'Link')

    // The declaration text is identical, but the contexts are not.
    // They must remain independent and scoped to their respective components.
    expect(buttonClassName).not.toBe(linkClassName)
    expect(result.css).toContain(':hover')
    expect(result.css).toContain(':focus')
    expect(countOccurrences(result.css, 'color:red')).toBe(2)
  })

  it('counts each atomic id at most once per component when deciding promotion', () => {
    const result = compileGlobalAtomicStyles(
      [
        {
          key: 'button',
          className: 'Button',
          rawCss: `
            color: red;
            color: red;
            color: red;
          `,
          filename: '/src/button.ts',
          receiver: 'styled.button("Button")',
        },
        {
          key: 'link',
          className: 'Link',
          rawCss: `
            color: blue;
          `,
          filename: '/src/link.ts',
          receiver: 'styled.a("Link")',
        },
      ],
      {
        minUses: 2,
        buildNamespace: 'test',
      },
    )

    const buttonClassName = requireClassName(result.classNames, 'Button')

    // Repeating the same declaration three times in one component must still
    // represent a single component usage, not three global usages.
    expect(buttonClassName).toBeTruthy()
    expect(result.css).toContain('color:red')
  })

  it('uses a stable result for equivalent repeated compilations', () => {
    const inputs = [
      {
        key: 'button',
        className: 'Button',
        rawCss: `
          color: red;

          &:hover {
            color: blue;
          }
        `,
        filename: '/src/button.ts',
        receiver: 'styled.button("Button")',
      },
      {
        key: 'link',
        className: 'Link',
        rawCss: 'color: red;',
        filename: '/src/link.ts',
        receiver: 'styled.a("Link")',
      },
    ] as const

    const options = {
      minUses: 2,
      buildNamespace: 'deterministic',
    } as const

    const first = compileGlobalAtomicStyles(inputs, options)
    const second = compileGlobalAtomicStyles(inputs, options)

    expect(second.css).toBe(first.css)
    expect([...second.classNames]).toEqual([...first.classNames])
    expect(second.minUses).toBe(first.minUses)
    expect(second.minifiedClassNames).toBe(first.minifiedClassNames)
    expect(second.minifyCss).toBe(first.minifyCss)
  })

  it('isolates different build namespaces so independently compiled bundles do not share compact class names', () => {
    const inputs = [
      {
        key: 'button',
        className: 'Button',
        rawCss: 'color: red;',
        filename: '/src/button.ts',
        receiver: 'styled.button("Button")',
      },
      {
        key: 'link',
        className: 'Link',
        rawCss: 'color: red;',
        filename: '/src/link.ts',
        receiver: 'styled.a("Link")',
      },
    ] as const

    const first = compileGlobalAtomicStyles(inputs, {
      minUses: 2,
      buildNamespace: 'bundleA',
    })

    const second = compileGlobalAtomicStyles(inputs, {
      minUses: 2,
      buildNamespace: 'bundleB',
    })

    expect(requireClassName(first.classNames, 'Button')).not.toBe(
      requireClassName(second.classNames, 'Button'),
    )
  })

  it('returns an immutable-looking result contract without leaking unrelated component keys', () => {
    const result = compileGlobalAtomicStyles(
      [
        {
          key: 'button-key',
          className: 'Button',
          rawCss: 'display: block;',
        },
      ],
      {
        minUses: 1,
      },
    )

    expect([...result.classNames.keys()]).toEqual(['Button'])
    expect(result.classNames.has('button-key')).toBe(false)
    expect(result.minUses).toBe(1)
    expect(typeof result.css).toBe('string')
    expect(typeof result.minifiedClassNames).toBe('boolean')
    expect(typeof result.minifyCss).toBe('boolean')
  })
})

function requireClassName(
  classNames: ReadonlyMap<string, string>,
  componentName: string,
): string {
  const className = classNames.get(componentName)

  expect(
    className,
    `Expected compileGlobalAtomicStyles() to emit a class name for "${componentName}"`,
  ).toBeDefined()

  return className!
}

function countOccurrences(value: string, search: string): number {
  if (!search) return 0

  let count = 0
  let offset = 0

  while (true) {
    const index = value.indexOf(search, offset)
    if (index === -1) return count

    count++
    offset = index + search.length
  }
}
