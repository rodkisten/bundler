import { formatInlineCss } from '@rodkisten/cipo/format'
import { parseStylesheet } from '@rodkisten/cipo/parser'
import { transformCss } from '@rodkisten/cipo/transform'
import type { CipoWarning } from '@rodkisten/cipo/types'
import { collectInlineCss } from '@rodkisten/cipo/compiler-inline-compile'

export function compileSafeInlineText(rawCss: string, important: boolean): string {
  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  return formatInlineCss(collectInlineCss(parseStylesheet(transformedCss, warnings), important))
}
