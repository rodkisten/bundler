import { insertCss, setRuntimeStyleTarget } from "../../cipo/src/injection";
import { devtoolsCipoRuntimeThemeCss } from "../cipo-runtime-theme";

let bootstrapped = false;

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
  if (bootstrapped) return;
  bootstrapped = true;

  setRuntimeStyleTarget(null);
  insertCss(devtoolsCipoRuntimeThemeCss);
}

bootstrapDevtoolsCipo();
