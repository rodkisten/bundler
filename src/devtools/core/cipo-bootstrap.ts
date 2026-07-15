import { insertCss, setRuntimeStyleTarget } from "../../cipo/src/injection";
import { devtoolsCipoRuntimeThemeCss } from "../cipo-runtime-theme";

/**
 * Installs only the runtime CSS required by the statically compiled DevTools.
 *
 * @remarks
 * The full Cipó `@cipo` / `@theme` DSL is intentionally build-time only. The
 * Vite plugin consumes it while compiling every static styled template, while
 * this bootstrap ships only the already-resolved token bridge. This prevents
 * the configuration sheet and `configureFromCss` parser graph from leaking into
 * the browser bundle.
 *
 * The runtime style sink stays disabled (`null`) until `installDevtoolsStyles`
 * retargets it into the shadow root (or light-DOM host). Compiled component CSS
 * and this token bridge accumulate in Cipó's runtime buffer without touching
 * `document.head` during module evaluation.
 */
export function bootstrapDevtoolsCipo(): void {
  // Reapply the bridge on every bootstrap attempt. `insertCss()` already
  // deduplicates live rules, while Cipó's public `reset()` intentionally clears
  // that dedupe state and generated CSS buffer. A module-level boolean would
  // therefore make subsequent DevTools mounts lose the runtime token bridge.
  setRuntimeStyleTarget(null);
  insertCss(devtoolsCipoRuntimeThemeCss);
}

bootstrapDevtoolsCipo();
