import { registerProperty } from './plugins'

const NATIVE_PROPERTY_GUARDS = [
  ['font', 'font'],
  ['content', 'content'],
  ['transform', 'transform'],
  ['direction', 'direction'],
  ['grid', 'grid'],
] as const

/**
 * Restores native CSS semantics for names that also have explicit Cipó aliases.
 *
 * Convenience forms remain available through their unambiguous names:
 * `fontFamily`, `textTransform`, `flexDirection`, `alignContent`, and `gridCols`.
 * User registrations can still override these guards after Cipó initializes.
 */
export function installNativePropertyGuards(): void {
  for (let index = 0; index < NATIVE_PROPERTY_GUARDS.length; index += 1) {
    const [name, property] = NATIVE_PROPERTY_GUARDS[index]!
    registerProperty(name, { property, scale: 'none' })
  }
}
