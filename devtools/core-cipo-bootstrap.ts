import { configureFromCss } from "@rodkisten/cipo/config-css";
import { setRuntimeStyleTarget } from "@rodkisten/cipo/injection";
import { devtoolsStyles } from "@rodkisten/devtools/core-style";

/**
 * Installs the DevTools Cipó configuration in the active runtime.
 *
 * @remarks
 * The readable CSS-first sheet remains the single source of truth. Development
 * and direct runtime usage parse it with `configureFromCss()`. During production
 * builds the Cipó Vite plugin rewrites this call to `configureCompiledCssConfig()`
 * with a compact payload generated from the exact same sheet, preserving runtime
 * theme/config behavior without shipping the raw DSL or parser graph.
 *
 * The style sink stays disabled until `installDevtoolsStyles()` retargets Cipó's
 * buffered CSS into the DevTools shadow root.
 */
export function bootstrapDevtoolsCipo(): void {
  setRuntimeStyleTarget(null);
  configureFromCss(devtoolsStyles.cssText);
}

// bootstrapDevtoolsCipo();
