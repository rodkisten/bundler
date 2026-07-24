/**
 * Backward-compatible compiler transform facade.
 *
 * The implementation lives under `compiler/transform.ts`, alongside its AST,
 * import analysis, serializer and edit utilities. Keeping this facade avoids
 * breaking repository-local imports without duplicating the compiler source.
 */
export type {
  FabricaCompileSourceOptions,
  FabricaCompileSourceResult,
  FabricaCompiledTemplateManifestEntry,
} from "./compiler/transform.js";
export { compileFabricaSource } from "./compiler/transform.js";
