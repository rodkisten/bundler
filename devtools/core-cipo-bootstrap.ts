import {
  configureFromCss,
  setRuntimeStyleTarget,
} from "@rodkisten/cipo";
import {
  devtoolsCipoConfigCss,
} from "@rodkisten/devtools/cipo-config";

/**
 * Installs the canonical DevTools Cipó configuration in the active runtime.
 *
 * @remarks
 * Development parses the readable CSS-first source directly. Production builds
 * replace this trusted call with `configureCompiledCssConfig()` and a compact
 * parser-free payload generated from the exact same configuration string.
 *
 * The style sink remains disabled until `installDevtoolsStyles()` retargets the
 * buffered compiled CSS and runtime token rules into the final ShadowRoot.
 */
export function bootstrapDevtoolsCipo(): void {
  setRuntimeStyleTarget(null);
  configureFromCss(devtoolsCipoConfigCss);
}
