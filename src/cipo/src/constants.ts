/**
 * Runtime constants shared across modules.
 *
 * @example
 * ```ts
 * import { STYLE_ELEMENT_ID } from './constants'
 * document.getElementById(STYLE_ELEMENT_ID)
 * ```
 */
export const STYLE_ELEMENT_ID = 'cipo-runtime-style'
export const HASH_SEED = 5381
export const HASH_MASK = 0xffffffff
export const DEFAULT_PREFIX = 'cipo'
export const EMPTY_STRING = ''
export const DEFAULT_BASE_FONT_SIZE = 16
export const DEFAULT_SPACING_VALUE = '0.25rem'

export const DEFAULT_LAYER_DECLARATION = '@layer cipo.reset, cipo.tokens, cipo.base, cipo.components, cipo.atomic, cipo.scoped, cipo.utilities, cipo.global, cipo.inline, cipo.overrides;'

export const HTML_TAGS = [
  'a','abbr','address','area','article','aside','audio','b','base','bdi','bdo','blockquote','body','br','button','canvas','caption','cite','code','col','colgroup','data','datalist','dd','del','details','dfn','dialog','div','dl','dt','em','embed','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','head','header','hgroup','hr','html','i','iframe','img','input','ins','kbd','label','legend','li','link','main','map','mark','menu','meta','meter','nav','noscript','object','ol','optgroup','option','output','p','picture','pre','progress','q','rp','rt','ruby','s','samp','script','section','select','slot','small','source','span','strong','style','sub','summary','sup','table','tbody','td','template','textarea','tfoot','th','thead','time','title','tr','track','u','ul','var','video','wbr',
] as const
