import { describe, expect, it } from 'vitest'
import { addImportant } from '../src/compiler/important'

describe('Cipó compiler/important', () => {
  it('adds exactly one important priority', () => {
    expect(addImportant('red')).toBe('red !important')
    expect(addImportant('red !important')).toBe('red !important')
  })
})
