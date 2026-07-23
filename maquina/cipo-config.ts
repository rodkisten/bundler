/**
 * Build-time Cipó configuration for Maquina.
 *
 * @remarks
 * Maquina deliberately keeps host-owned colors in `--maq-*` variables while
 * Cipó owns package-local breakpoints, aliases, helpers and typed runtime
 * properties. The same readable sheet is consumed by source/package builds and
 * lowered to a compact parser-free payload by the Vite integration.
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
`;
