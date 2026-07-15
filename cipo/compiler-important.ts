/** Utilities that normalize declaration priority. */

/**
 * Adds one `!important` priority to a declaration value.
 *
 * @remarks
 * The function is deliberately idempotent so `withImportant` can be applied to
 * user CSS that already contains `!important` without producing invalid
 * `!important !important` output.
 */
export function addImportant(value: string): string {
  return /\s!important\s*$/i.test(value) ? value : `${value} !important`
}
