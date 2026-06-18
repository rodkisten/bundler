/**
 * HTML tag names shared by Fabrica Elements and consumers that need tag factories.
 *
 * @remarks
 * This file intentionally lives in `fabrica-elements` instead of Cipó. Element
 * creation is the concern of Fabrica Elements, while Cipó can import this list
 * only when it builds styled tag helpers. Keeping the dependency direction this
 * way avoids the old `fabrica-elements -> cipo` cycle and makes the package
 * usable without the CSS runtime.
 */
export const HTML_TAGS = [
  'a','abbr','address','area','article','aside','audio','b','base','bdi','bdo','blockquote','body','br','button','canvas','caption','cite','code','col','colgroup','data','datalist','dd','del','details','dfn','dialog','div','dl','dt','em','embed','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','head','header','hgroup','hr','html','i','iframe','img','input','ins','kbd','label','legend','li','link','main','map','mark','menu','meta','meter','nav','noscript','object','ol','optgroup','option','output','p','picture','pre','progress','q','rp','rt','ruby','s','samp','script','section','select','slot','small','source','span','strong','style','sub','summary','sup','table','tbody','td','template','textarea','tfoot','th','thead','time','title','tr','track','u','ul','var','video','wbr'
] as const;

export type HtmlTagName = typeof HTML_TAGS[number];
