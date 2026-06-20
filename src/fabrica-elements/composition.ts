import type { ElementsRecord, ElementsRefValue } from './types'
import { composeRefs, mergeClassNames } from './utils'

/**
 * Composes event handlers while preserving call order and cancellation.
 *
 * @param handlers - Handlers to run from left to right.
 * @returns Composed handler.
 *
 * @example
 * ```ts
 * const onClick = composeEvents(track, save)
 * button.addEventListener('click', onClick)
 * ```
 */
export function composeEvents<EventType extends Event = Event>(...handlers: readonly (((event: EventType) => void) | null | undefined | false)[]): (event: EventType) => void {
  return function composedEvent(event: EventType): void {
    for (let index = 0; index < handlers.length; index += 1) {
      const handler = handlers[index]
      if (typeof handler !== 'function') continue
      handler(event)
      if (event.cancelBubble) break
    }
  }
}

/**
 * Merges props for component composition.
 *
 * @remarks
 * Class names are merged, `style` objects are shallow merged, callback refs are
 * composed, and event props such as `onClick` are chained instead of replacing
 * one another. Later props still override plain scalar values.
 *
 * @param inputs - Props objects ordered from base to override.
 * @returns Merged props.
 *
 * @example
 * ```ts
 * composeProps(
 *   { class: 'button', onClick: track },
 *   { class: ['primary'], onClick: save },
 * )
 * // { class: 'button primary', onClick: composedEvent }
 * ```
 */
export function composeProps(...inputs: readonly (ElementsRecord | null | undefined)[]): ElementsRecord {
  const output: ElementsRecord = {}

  for (let index = 0; index < inputs.length; index += 1) {
    const props = inputs[index]
    if (!props) continue

    for (const key in props) {
      const value = props[key]
      const previous = output[key]

      if (key === 'class' || key === 'className') {
        output[key] = mergeClassNames(previous as never, value as never)
        continue
      }

      if (key === 'style' && isPlainRecord(previous) && isPlainRecord(value)) {
        output[key] = { ...previous, ...value }
        continue
      }

      if (key === 'ref' && previous) {
        output[key] = composeRefs(previous as ElementsRefValue, value as ElementsRefValue)
        continue
      }

      if (isEventProp(key) && typeof previous === 'function' && typeof value === 'function') {
        output[key] = composeEvents(previous as (event: Event) => void, value as (event: Event) => void)
        continue
      }

      output[key] = value
    }
  }

  return output
}

/**
 * Extracts named children from a light slot object without imposing a renderer.
 *
 * @param slots - Slot dictionary.
 * @param name - Slot name.
 * @param fallback - Optional fallback value.
 * @returns Slot value or fallback.
 *
 * @example
 * ```ts
 * const header = slot(props.slots, 'header', 'Untitled')
 * ```
 */
export function slot(slots: unknown, name: string, fallback: unknown = null): unknown {
  if (!isPlainRecord(slots)) return fallback
  return Object.prototype.hasOwnProperty.call(slots, name) ? slots[name] : fallback
}

/**
 * Creates a polymorphic component wrapper with an `as` prop.
 *
 * @param fallback - Default tag or component.
 * @param render - Renderer callback.
 * @returns Component accepting `as` while preserving the existing props object.
 *
 * @example
 * ```ts
 * const Box = polymorphic('div', (as, props) => elements(String(as))({ ...props }))
 * Box({ as: 'button', type: 'button', children: 'Save' })
 * ```
 */
export function polymorphic<Props extends ElementsRecord = ElementsRecord, Output = unknown>(
  fallback: string | ((props: Props) => Output),
  render: (as: string | ((props: Props) => Output), props: Props) => Output,
): (props?: Props & { as?: string | ((props: Props) => Output) }) => Output {
  return function PolymorphicComponent(props = {} as Props & { as?: string | ((props: Props) => Output) }): Output {
    const { as, ...rest } = props
    return render(as ?? fallback, rest as Props)
  }
}

function isEventProp(key: string): boolean {
  return key.length > 2 && key[0] === 'o' && key[1] === 'n' && key[2] === key[2]?.toUpperCase()
}

function isPlainRecord(value: unknown): value is ElementsRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export type RecipeSlot<Value = unknown> = Value | ((props: ElementsRecord) => Value)

export type ElementsRecipeDefinition = {
  readonly base?: RecipeSlot<ElementsRecord>
  readonly variants?: Record<string, Record<string, RecipeSlot<ElementsRecord>>>
  readonly defaults?: Record<string, string | boolean>
  readonly compound?: readonly (ElementsRecord & { readonly props: RecipeSlot<ElementsRecord> })[]
}

/**
 * Creates a prop recipe without choosing a renderer.
 *
 * @remarks
 * This mirrors Panda-style recipes at the element-prop layer. It composes class,
 * style, refs and events through `composeProps()` and returns plain props, so it
 * works for DOM, React payloads, Fabrica payloads and Cipó styled components
 * without adding a new public rendering contract.
 *
 * @param definition - Recipe definition with base, variants, defaults and compounds.
 * @returns Recipe function that returns composed props.
 *
 * @example
 * ```ts
 * const button = recipeProps({
 *   base: { class: 'btn', type: 'button' },
 *   variants: { tone: { primary: { class: 'btn-primary' } } },
 *   defaults: { tone: 'primary' },
 * });
 * button({ tone: 'primary', class: 'extra' });
 * // { class: 'btn btn-primary extra', type: 'button' }
 * ```
 */
export function recipeProps(definition: ElementsRecipeDefinition): (options?: ElementsRecord) => ElementsRecord {
  return function resolveRecipeProps(options: ElementsRecord = {}): ElementsRecord {
    const chunks: ElementsRecord[] = []
    const base = resolveRecipeSlot(definition.base, options)
    if (base) chunks[chunks.length] = base

    const defaults = definition.defaults || {}
    const variants = definition.variants || {}

    for (const variantName in variants) {
      const value = options[variantName] ?? defaults[variantName]
      if (value === false || value === null || value === undefined) continue
      const choice = variants[variantName]?.[String(value)]
      const props = resolveRecipeSlot(choice, options)
      if (props) chunks[chunks.length] = props
    }

    const compounds = definition.compound || []
    for (let index = 0; index < compounds.length; index += 1) {
      const compound = compounds[index]
      if (!compound || !matchesCompound(compound, options, defaults)) continue
      const props = resolveRecipeSlot(compound.props, options)
      if (props) chunks[chunks.length] = props
    }

    chunks[chunks.length] = options
    return composeProps(...chunks)
  }
}

function resolveRecipeSlot(slotValue: RecipeSlot<ElementsRecord> | undefined, options: ElementsRecord): ElementsRecord | null {
  if (!slotValue) return null
  const value = typeof slotValue === 'function' ? slotValue(options) : slotValue
  return isPlainRecord(value) ? value : null
}

function matchesCompound(compound: ElementsRecord, options: ElementsRecord, defaults: Record<string, string | boolean>): boolean {
  for (const key in compound) {
    if (key === 'props') continue
    const expected = compound[key]
    const actual = options[key] ?? defaults[key]
    if (Array.isArray(expected)) {
      let found = false
      for (let index = 0; index < expected.length; index += 1) {
        if (expected[index] === actual) {
          found = true
          break
        }
      }
      if (!found) return false
      continue
    }
    if (actual !== expected) return false
  }
  return true
}
