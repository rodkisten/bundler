export {
  getCompiledJsxTemplate,
  getCompiledTemplate,
  hasNamedComponentTagSyntax,
} from "./cache.js";
export {
  buildTemplateSource,
  isAttributePosition,
  isImplicitSpreadAttributePosition,
  isSpreadAttributePosition,
  normalizeInterpolatedComponentSelfClosingTags,
  normalizeQuotedDataAttributeNames,
  normalizeStaticDataAttributeNames,
  readAttributeBindingName,
  transformMicroJsxChunk,
} from "./source.js";
export {
  comparePathsReverse,
  compileParts,
  getNodePath,
  resolvePath,
} from "./parts.js";
