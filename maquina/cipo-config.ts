/**
 * Build-time and runtime Cipó configuration for Maquina.
 *
 * Host applications may continue overriding the public `--maq-*` custom
 * properties. Cipó maps those host-owned values into semantic theme tokens,
 * keeping component styles independent from the underlying CSS variable names.
 *
 * Runtime editor state, such as scroll offsets, gutter width, font size and
 * tab size, remains expressed through typed `$$` properties rather than theme
 * tokens.
 */
export const maquinaCipoConfigCss = `
@cipo {
  prefix: maq;
  debug: true;
  layers: false;
  minify: false;
  atomic-min-uses: 3;
  rem: 16px;
  color-mode: oklch;
  theme-validation: warn;
}

@breakpoints {
  compact: 520px;
  md: 768px;
}

@theme {
  colors: (
    background: var(--maq-background),
    foreground: var(--maq-foreground),
    border: var(--maq-border),
    surface: var(--maq-surface),
    accent: var(--maq-accent),
    muted: var(--maq-muted),
    selection: var(--maq-selection),

    syntax-comment: var(--maq-comment),
    syntax-string: var(--maq-string),
    syntax-number: var(--maq-number),
    syntax-boolean: var(--maq-boolean),
    syntax-keyword: var(--maq-keyword),
    syntax-property: var(--maq-property),
    syntax-tag: var(--maq-tag),
    syntax-attribute: var(--maq-attribute),
    syntax-punctuation: var(--maq-punctuation)
  );

  radius: (
    editor: 14px,
    suggestions: 12px,
    suggestion: 8px
  );

  spacing: (
    editor-top: 14px,
    editor-inline: 16px,
    editor-bottom: 26px,

    line-number-inline: 12px,

    suggestions: 6px,

    suggestion-block: 9px,
    suggestion-inline: 11px,
    suggestion-gap: 12px
  );

  sizes: (
    suggestions-width: 280px,
    suggestions-max-height: 240px,
    suggestion-min-height: 42px,
    suggestion-detail-max-width: 14ch
  );

  typography: (
    editor-line-height: 1.55,
    editor-weight: 500,
    suggestion-detail-size: 0.78em
  );

  fonts: (
    code: var(
      --maq-font,
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      monospace
    )
  );

  opacity: (
    surface: 96%,
    suggestion-active: 20%,
    suggestion-hover: 16%
  );

  effects: (
    suggestions-blur: 18px,
    suggestions-saturation: 120%
  );
}

@alias editor-reset {
  border: 0;
  outline: 0;
  appearance: none;
}

@helper touch-scroll {
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

@property $$gutterWidth {
  syntax: "<length>";
  inherits: true;
  initial: 0px;
}

@property $$scrollX {
  syntax: "<length>";
  inherits: true;
  initial: 0px;
}

@property $$fontSize {
  syntax: "<length>";
  inherits: true;
  initial: 16px;
}

@property $$tabSize {
  syntax: "<number>";
  inherits: true;
  initial: 2;
}
`;
