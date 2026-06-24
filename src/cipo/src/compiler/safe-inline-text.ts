import { formatInlineCss } from '../format'
import { parseStylesheet } from '../parser'
import { transformCss } from '../transform'
import type { CipoWarning } from '../types'
import { collectInlineCss } from './inline-compile'

export function compileSafeInlineText(rawCss: string, important: boolean): string {
  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  return formatInlineCss(collectInlineCss(parseStylesheet(transformedCss, warnings), important))
}
