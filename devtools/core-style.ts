import { sheet } from "@rodkisten/cipo";
import { STYLE_ELEMENT_ID } from "@rodkisten/cipo/constants";
import {
  injectStyle,
  setRuntimeStyleTarget,
} from "@rodkisten/cipo/injection";
import type {
  CipoCssArtifact,
  CipoInjectableStyleArtifact,
  CipoInlineCssArtifact,
  CipoStylesheetArtifact,
} from "@rodkisten/cipo/types";
import { bootstrapDevtoolsCipo } from "@rodkisten/devtools/core-cipo-bootstrap";
import { appendArrayValues, forEachArray } from "@rodkisten/nascente";

/* *************** */
/* Global system   */
/* *************** */

// bootstrapDevtoolsCipo();

/**
 * Global DevTools stylesheet.
 *
 * @remarks
 * Component-specific layout and appearance belong to Cipó styled components.
 * This sheet intentionally contains only:
 *
 * - host-level runtime variables;
 * - cross-component DOM normalization;
 * - accessibility utilities;
 * - generic serialized-value styling;
 * - generic object-inspector styling;
 * - reduced-motion behavior.
 *
 * Keeping component selectors out of this sheet prevents the runtime global
 * stylesheet from competing with compiled atomic styled-component output.
 */
export const devtoolsStyles = sheet.css`
  @cipo {
    prefix: rd;
    layers: false;
    minify: true;
    rem: 16px;
    color-mode: oklch;
    theme-root: :host;
    theme-validation: warn;
  }

  @theme {
    zIndex<number>: (
      base: 2147483500,
      container: 2147483510,
      dock: 2147483520,
      toolbar: 2147483530,
      sticky: 2147483540,
      dropdown: 2147483550,
      notification: 2147483560,
      modal: 2147483570,
      inspector: 2147483580,
      resizer: 2147483590,
      entry: 2147483600
    );

    colors<color>: (
      background: var(--background),
      backgroundDark: var(--darker-background),
      foreground: var(--foreground),
      primary: var(--primary),
      accent: var(--accent),
      border: var(--border),
      highlight: var(--highlight),
      contrast: var(--contrast),
      selectedForeground: var(--select-foreground),
      link: var(--link-color),
      success: #2e8b57,
      danger: var(--console-error-foreground),
      post: #8a63d2,
      statusRedirect: #c18401,
      warningBg: var(--console-warn-background),
      warningFg: var(--console-warn-foreground),
      warningBorder: var(--console-warn-border),
      errorBg: var(--console-error-background),
      errorFg: var(--console-error-foreground),
      errorBorder: var(--console-error-border),
      operator: var(--operator-color),
      keyword: var(--keyword-color),
      string: var(--string-color),
      number: var(--number-color),
      function: var(--function-color),
      tag: var(--tag-name-color),
      attr: var(--attribute-name-color),
      var: var(--var-color),
      comment: var(--comment-color)
    );

    spacing<size>: 0.25rem;

    radius<length>: (
      xs: 3px,
      sm: 4px,
      md: 5px,
      control: 6px,
      section: 7px,
      notification: 8px,
      panel: 10px,
      modal: 10px,
      pill: 999px
    );

    shadow<shadow>: (
      entry: 0 4px 18px rgb(0 0 0 / .22),
      panel: 0 -18px 60px rgb(0 0 0 / .2),
      notification: 0 8px 30px rgb(0 0 0 / .24),
      modal: 0 24px 90px rgb(0 0 0 / .4)
    );

    font<font>: (
      ui: -apple-system, system-ui, BlinkMacSystemFont, ".SFNSDisplay-Regular", "Helvetica Neue", "Lucida Grande", "Segoe UI", Tahoma, sans-serif,
      mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace
    );
  }

  @breakpoints {
    xs: 520px;
    md: 680px;
  }


  /*
   * Runtime-only variables that are consumed across independently compiled
   * styled components or updated dynamically by the DevTools controller.
   */
  :host {
    contain: layout style;
    color-scheme: dark light;

    --rd-safe-bottom: max(
      env(safe-area-inset-bottom, 0px),
      10px
    );
  }

  /*
   * Global DOM normalization.
   *
   * Component geometry, colors, spacing and interaction states deliberately
   * stay outside this block and belong to their owning styled components.
   */
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: none;
  }

  :host button,
  :host input,
  :host textarea,
  :host select {
    font: inherit;
    color: inherit;
  }

  :host button {
    appearance: none;
  }

  /*
   * Generic accessibility utilities are intentionally global because they may
   * be emitted by render helpers instead of a dedicated styled component.
   */
  .roderuda-hidden {
    display: none !important;
  }

  .roderuda-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /*
   * Generic serialized values are emitted from multiple panels and recursive
   * render helpers. These semantic classes therefore remain global instead of
   * being duplicated by every panel-specific component tree.
   */
  .roderuda-value {
    user-select: text;
  }

  .roderuda-value-null,
  .roderuda-value-undefined,
  .roderuda-value-boolean {
    color: $keyword;
  }

  .roderuda-value-string {
    color: $string;
  }

  .roderuda-value-number,
  .roderuda-value-bigint {
    color: $number;
  }

  .roderuda-value-function {
    color: $function;
  }

  .roderuda-value-node {
    color: $tag;
    cursor: pointer;
  }

  .roderuda-value-error {
    color: $errorFg;
  }

  /*
   * Recursive object output is shared by Console, Network, Info and other
   * inspectors. The renderer emits semantic native <details>/<summary> markup,
   * making this a global rendering primitive rather than panel UI chrome.
   */
  details.roderuda-object {
    display: inline;
  }

  details.roderuda-object > summary {
    display: inline;
    cursor: pointer;
    list-style: none;
    color: $primary;
  }

  details.roderuda-object > summary::-webkit-details-marker {
    display: none;
  }

  details.roderuda-object > summary::before {
    content: "▸";
    display: inline-block;
    width: 12px;
    color: $operator;
  }

  details.roderuda-object[open] > summary::before {
    content: "▾";
  }

  .roderuda-object-body {
    min-width: 0;
    max-width: 100%;
    margin: 3px 0 3px 15px;
    padding-left: 8px;
    overflow-wrap: anywhere;
    border-left: 1px solid $border;
  }

  .roderuda-object-row {
    min-width: 0;
    max-width: 100%;
    min-height: 20px;
    overflow-wrap: anywhere;
  }

  .roderuda-object-key {
    margin-right: 5px;
    color: $attr;
  }

  /*
   * Search highlighting is produced by shared source/text renderers and may
   * occur inside several unrelated styled component trees.
   */
  .roderuda-search-highlight-block {
    display: inline;
  }

  .roderuda-search-highlight-block .roderuda-keyword {
    background: $warningBg;
    color: $warningFg;
  }

  /*
   * Accessibility preference that must apply uniformly to every component,
   * including styled components registered after the shell is mounted.
   */
  reduce-motion {
    :host *,
    :host *::before,
    :host *::after {
      animation-duration: .001ms !important;
      transition-duration: .001ms !important;
    }
  }
`;

/**
 * Side-effect export used by modules that only need to ensure the global
 * DevTools theme and tokens have been evaluated.
 */
export const devtoolsTokens = devtoolsStyles;

export type DevtoolsStyleArtifact =
  | CipoCssArtifact
  | CipoInlineCssArtifact
  | CipoStylesheetArtifact;

/**
 * Installs the minimal global DevTools stylesheet and any explicitly supplied
 * style artifacts into the final mount target.
 *
 * @remarks
 * Styled-component rules are registered independently with Cipó and share its
 * canonical runtime sink. The already-generated runtime CSS must never be read
 * with `getCssText()` and injected again here, otherwise every registered
 * styled rule is duplicated.
 */
export function installDevtoolsStyles(
  target: ShadowRoot | HTMLElement | Document,
  additionalStyles: readonly DevtoolsStyleArtifact[] = [],
): HTMLStyleElement {
  bootstrapDevtoolsCipo();

  /*
   * Establish the final canonical sink before installing global or additional
   * artifacts. Any styled components evaluated afterwards will append their
   * rules to this same target.
   */
  setRuntimeStyleTarget(target);

  const parent =
    target instanceof Document
      ? target.head
      : target;

  /*
   * Remove installation tags created by an earlier DevTools mount without
   * touching Cipó's canonical runtime sink.
   */
  forEachArray(
    parent.querySelectorAll?.(
      'style[data-roderuda-devtools-style="true"]',
    ),
    (node) => node.remove(),
  );

  const artifacts: CipoInjectableStyleArtifact[] = [
    devtoolsStyles,
  ];

  appendArrayValues(
    artifacts,
    additionalStyles,
  );

  /*
   * Keep Cipó's default rule-level deduplication enabled. This is especially
   * important when several panels reference the same shared styled component.
   */
  const style =
    injectStyle(
      target,
      artifacts,
      {
        position: "prepend",
      },
    );

  style.dataset.roderudaDevtoolsStyle =
    "true";

  /*
   * A temporary sink can exist in document.head when styled modules are
   * evaluated before the ShadowRoot is available. Retargeting should normally
   * move/reuse it; this cleanup only handles a genuinely orphaned copy.
   */
  if (
    !(target instanceof Document)
  ) {
    const orphan =
      document.getElementById(
        STYLE_ELEMENT_ID,
      );

    if (
      orphan
      && orphan !== style
      && orphan.parentElement === document.head
    ) {
      orphan.remove();
    }
  }

  if (
    !style.textContent?.trim()
  ) {
    throw new Error(
      "[RodEruda] Unable to install global DevTools styles",
    );
  }

  return style;
}
