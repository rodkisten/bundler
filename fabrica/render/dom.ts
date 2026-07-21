/**
 * Compatibility facade for the renderer internals.
 *
 * The implementation is intentionally split by responsibility. Keep this
 * module thin so existing internal imports can migrate incrementally without
 * recreating the previous renderer dependency hub.
 */
export {
  createHtmlResult,
  getHtmlArtifact,
  getHtmlResultMetadata,
  isHtmlResult,
  pruneInsignificantWhitespace,
} from "./html-result.js";
export {
  mount,
  mountPreservingChildren,
  render,
} from "./root.js";
export { html, jsx } from "./template-runtime.js";
export { appendValue } from "./value.js";
