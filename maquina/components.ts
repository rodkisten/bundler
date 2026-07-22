import { createStyled } from "@rodkisten/cipo";
import { createFabrica } from "@rodkisten/fabrica";

/**
 * Maquina owns one isolated Fábrica registry shared by every editor instance.
 */
export const maquinaFabrica = createFabrica({
  name: "maquina",
  isolated: true,
});

export const html = maquinaFabrica.html;
export const component = maquinaFabrica.component;
export const event = maquinaFabrica.event;
export const ref = maquinaFabrica.ref;

export const styled = createStyled({
  fabrica: maquinaFabrica,
});

styled.connectRegistry(maquinaFabrica);

export const MaquinaRoot = styled.div("MaquinaRoot").css`
  position: relative;
  isolation: isolate;
  contain: layout paint style;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  border: 1px solid var(--maq-border);
  border-radius: 14px;
  background: var(--maq-background);
  color: var(--maq-foreground);
  box-shadow:
    0 16px 48px rgb(0 0 0 / 18%),
    inset 0 1px rgb(255 255 255 / 3.5%);
`;

export const MaquinaViewport = styled.div("MaquinaViewport").css`
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

/**
 * Visual code layer. The textarea remains the input and scroll authority.
 * Logical rows let line numbers and wrapped code share exactly the same height.
 */
export const MaquinaHighlight = styled.div("MaquinaHighlight").css`
  position: absolute;
  inset: 0;
  z-index: 0;
  contain: paint;
  min-width: 100%;
  min-height: 100%;
  padding: 14px 0 26px;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  font: 500 var(--maq-font-size, 16px) / 1.55 var(
    --maq-font,
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace
  );
  tab-size: var(--maq-tab-size, 2);
  color: var(--maq-foreground);
  transform: translateY(var(--maq-scroll-y, 0px));
  will-change: transform;

  & [data-token="comment"] {
    color: var(--maq-comment);
  }

  & [data-token="string"] {
    color: var(--maq-string);
  }

  & [data-token="number"] {
    color: var(--maq-number);
  }

  & [data-token="boolean"] {
    color: var(--maq-boolean);
  }

  & [data-token="keyword"] {
    color: var(--maq-keyword);
  }

  & [data-token="property"] {
    color: var(--maq-property);
  }

  & [data-token="tag"] {
    color: var(--maq-tag);
  }

  & [data-token="attribute"] {
    color: var(--maq-attribute);
  }

  & [data-token="punctuation"] {
    color: var(--maq-punctuation);
  }
`;

export const MaquinaLine = styled.div("MaquinaLine").css`
  display: grid;
  grid-template-columns:
    var(--maq-gutter-width, 0px)
    minmax(0, 1fr);
  align-items: stretch;
  min-width: 100%;
  min-height: 1.55em;
`;

export const MaquinaLineNumber = styled.span("MaquinaLineNumber").css`
  position: relative;
  z-index: 2;
  display: block;
  align-self: stretch;
  box-sizing: border-box;
  padding-right: 12px;
  border-right: 1px solid var(--maq-border);
  background: var(--maq-background);
  color: var(--maq-muted);
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

export const MaquinaCodeClip = styled.span("MaquinaCodeClip").css`
  display: block;
  min-width: 0;
  overflow: hidden;
`;

export const MaquinaLineCode = styled.span("MaquinaLineCode").css`
  display: block;
  min-width: 0;
  box-sizing: border-box;
  padding: 0 16px;
  white-space: var(--maq-white-space, pre-wrap);
  overflow-wrap: var(--maq-overflow-wrap, anywhere);
  transform: translateX(var(--maq-scroll-x, 0px));
`;

/**
 * Native input layer. It always fills the viewport and shares exact text
 * metrics and gutter padding with the visual layer, keeping the native caret
 * aligned with highlighted glyphs on iOS and desktop browsers.
 */
export const MaquinaInput = styled.textarea("MaquinaInput").css`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding:
    14px
    16px
    26px
    calc(var(--maq-gutter-width, 0px) + 16px);
  box-sizing: border-box;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  resize: none;
  border: 0;
  outline: 0;
  appearance: none;
  background: transparent;
  color: transparent;
  caret-color: var(--maq-foreground);
  -webkit-text-fill-color: transparent;
  font: 500 var(--maq-font-size, 16px) / 1.55 var(
    --maq-font,
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace
  );
  tab-size: var(--maq-tab-size, 2);
  white-space: var(--maq-white-space, pre-wrap);
  overflow-wrap: var(--maq-overflow-wrap, anywhere);
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
  contain: layout paint style;
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 280px;
  max-width: 100%;
  max-height: 240px;
  padding: 6px;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  border: 1px solid var(--maq-border);
  border-radius: 12px;
  background: color-mix(
    in srgb,
    var(--maq-surface) 96%,
    transparent
  );
  box-shadow:
    0 18px 50px rgb(0 0 0 / 35%),
    inset 0 1px rgb(255 255 255 / 4%);
  backdrop-filter: blur(18px) saturate(120%);

  &[hidden] {
    display: none;
  }
`;

/**
 * Options are non-focusable listbox rows. Keeping DOM focus on the textarea
 * preserves the mobile keyboard while taps and vertical gestures remain native.
 */
export const MaquinaSuggestion = styled.div("MaquinaSuggestion").css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  flex: 0 0 auto;
  width: 100%;
  min-height: 42px;
  gap: 12px;
  margin: 0;
  padding: 9px 11px;
  box-sizing: border-box;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--maq-foreground);
  text-align: left;
  font: inherit;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;

  &[data-active="true"] {
    background: color-mix(
      in srgb,
      var(--maq-accent) 20%,
      transparent
    );
  }

  @media (hover: hover) {
    &:hover {
      background: color-mix(
        in srgb,
        var(--maq-accent) 16%,
        transparent
      );
    }
  }

  & > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & > small {
    max-width: 14ch;
    overflow: hidden;
    color: var(--maq-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.78em;
  }
`;

styled.flushRegistry();

/** All Cipó artifacts created by this factory, collected automatically. */
export const maquinaStyleArtifacts = styled.registry.cssArtifacts;
