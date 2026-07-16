/**
 * Build-time Cipó configuration for Maquina.
 *
 * @remarks
 * Maquina deliberately styles its runtime theme through `--maq-*` custom
 * properties, so the compiler only needs package-level behavior here. Keeping
 * this configuration minimal avoids generating a second theme-token layer and
 * preserves the small standalone editor bundle.
 */
export const maquinaCipoConfigCss = `
@cipo {
  prefix: maq;
  debug: false;
  layers: false;
  minify: true;
  atomic-min-uses: 2;
  rem: 16px;
  color-mode: oklch;
  theme-validation: warn;
}
`;
