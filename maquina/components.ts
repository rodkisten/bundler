import { createStyled } from "@rodkisten/cipo";
import { createFabrica } from "@rodkisten/fabrica";

export const maquinaFabrica = createFabrica({ name: "maquina", isolated: true });
export const html = maquinaFabrica.html;
export const component = maquinaFabrica.component;
export const event = maquinaFabrica.event;
export const ref = maquinaFabrica.ref;
export const styled = createStyled({ fabrica: maquinaFabrica });
styled.connectRegistry(maquinaFabrica);
styled.flushRegistry();

export const MaquinaRoot = styled.div("MaquinaRoot").css`
  position: relative;
  display: grid;
  grid-template-rows: 1fr;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--maq-border);
  border-radius: 14px;
  background: var(--maq-background);
  color: var(--maq-foreground);
  box-shadow: 0 16px 48px rgb(0 0 0 / .18), inset 0 1px rgb(255 255 255 / .035);
`;

export const MaquinaViewport = styled.div("MaquinaViewport").css`
  position: relative;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
`;

export const MaquinaHighlight = styled.pre("MaquinaHighlight").css`
  position: absolute;
  inset: 0;
  z-index: 0;
  min-width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 14px 16px 26px;
  box-sizing: border-box;
  pointer-events: none;
  white-space: pre;
  overflow: hidden;
  font: 500 16px/1.55 var(--maq-font, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  tab-size: var(--maq-tab-size, 2);
  color: var(--maq-foreground);
`;

export const MaquinaInput = styled.textarea("MaquinaInput").css`
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 14px 16px 26px;
  box-sizing: border-box;
  resize: none;
  border: 0;
  outline: 0;
  appearance: none;
  background: transparent;
  color: transparent;
  caret-color: var(--maq-foreground);
  -webkit-text-fill-color: transparent;
  font: 500 16px/1.55 var(--maq-font, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  tab-size: var(--maq-tab-size, 2);
  white-space: pre;
  overflow: hidden;
  user-select: text;
  -webkit-user-select: text;
  touch-action: pan-y pan-x;

  &::selection {
    background: var(--maq-selection);
  }

  &::placeholder {
    color: var(--maq-muted);
    -webkit-text-fill-color: var(--maq-muted);
  }
`;

export const MaquinaSuggestions = styled.div("MaquinaSuggestions").css`
  position: absolute;
  z-index: 20;
  min-width: 210px;
  max-width: min(420px, calc(100% - 24px));
  max-height: 240px;
  overflow: auto;
  border: 1px solid var(--maq-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--maq-surface) 96%, transparent);
  box-shadow: 0 18px 50px rgb(0 0 0 / .35);
  backdrop-filter: blur(18px);
  padding: 6px;
`;

export const MaquinaSuggestion = styled.button("MaquinaSuggestion").css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  width: 100%;
  gap: 12px;
  border: 0;
  border-radius: 8px;
  padding: 8px 10px;
  background: transparent;
  color: var(--maq-foreground);
  text-align: left;
  font: inherit;

  &[data-active="true"], &:hover {
    background: color-mix(in srgb, var(--maq-accent) 18%, transparent);
  }
`;

/** All Cipó artifacts created by this styled factory, collected automatically. */
export const maquinaStyleArtifacts = styled.registry.cssArtifacts;
