/**
 * Canonical CSS-first Cipó configuration for RodEruda.
 *
 * Kept separate from the runtime global stylesheet so production builds can
 * lower this DSL into a compiled payload and tree-shake the readable source.
 */
export const devtoolsCipoConfigCss = String.raw`
  @cipo {
    prefix: rd;
    layers: false;
    minify: true;
    rem: 16px;
    color-mode: oklch;
    theme-root: :host;
    theme-validation: warn;
    min-theme-uses: 4;
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
   * Shared authoring primitives intentionally cover both Cipó generations.
   * New code can consume aliases as standalone declarations, while legacy
   * components can keep dollar aliases and @with(...) during incremental migration.
   */
  @alias control-reset {
    appearance: none;
    border: 0;
    margin: 0;
  }

  @alias truncate-inline {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @helper interactive-surface {
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  @helper touch-scroll {
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  @property $$shellReveal {
    syntax: "<number>";
    inherits: true;
    initial: 0;
  }

`;
