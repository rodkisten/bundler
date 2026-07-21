export type {
  FabricaCompiledElementProps,
  CompactRuntimeCompiledTemplate,
  CompactRuntimeNode,
  CompactRuntimeProp,
  RuntimeCompiledTemplate,
  RuntimeCompiledTemplateInput,
  RuntimeComponent,
  RuntimeNode,
  RuntimeProp,
} from "./compiler/runtime/types.js";
export {
  applyCompiledProps,
  createCompiledElement,
  createCompiledFragment,
} from "./compiler/runtime/element.js";
export { createCompiledTemplate } from "./compiler-runtime.js";
export type {
  FabricaCompileSourceOptions,
  FabricaCompileSourceResult,
  FabricaCompiledTemplateManifestEntry,
} from "./compiler/transform.js";
export { compileFabricaSource } from "./compiler/transform.js";
