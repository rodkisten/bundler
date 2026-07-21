/**
 * Runtime-safe inline CSS compiler entrypoint.
 *
 * This module intentionally exports only the inline declaration compiler used
 * by browser runtimes. It does not import the source compiler, TypeScript, or
 * build-tool integrations, keeping runtime dependency graphs compiler-free.
 */
export {
  collectInlineCss,
  compileInlineCss,
} from "./engine/inline/compile.js";
