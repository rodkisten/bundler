import { configureFromCss } from "../../cipo";
import { setRuntimeStyleTarget } from "../../cipo/src/injection";
import { devtoolsCipoConfigCss } from "../cipo-config";

let bootstrapped = false;

/**
 * Applies the Devtools Cipó theme/config before any `styled` / `css` / `sheet`
 * evaluation. Styled components compile tokens at definition time, so this must
 * run before `createStyled()` factories and before any panel/shell modules.
 *
 * The runtime style sink stays disabled (`null`) until `installDevtoolsStyles`
 * retargets it into the shadow root (or light-DOM host). That keeps compiled
 * CSS out of `document.head` while modules load, then moves the accumulated
 * runtime CSS into the isolated mount target.
 */
export function bootstrapDevtoolsCipo(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  setRuntimeStyleTarget(null);
  configureFromCss(devtoolsCipoConfigCss);
}

bootstrapDevtoolsCipo();
