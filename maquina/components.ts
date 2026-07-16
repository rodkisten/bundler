import { createStyled } from "@rodkisten/cipo";
import { createFabrica } from "@rodkisten/fabrica";

/**
 * Maquina owns a single isolated Fabrica instance.
 *
 * Keeping the renderer and styled registry module-scoped avoids recreating
 * registries, component definitions, and stylesheet infrastructure per editor.
 */
export const maquinaFabrica = createFabrica({
  name: "maquina",
  isolated: true,
});

export const html = maquinaFabrica.html;
export const component = maquinaFabrica.component;
export const event = maquinaFabrica.event;
export const ref = maquinaFabrica.ref;

/**
 * Styled components share Fabrica's registry so component registration and
 * stylesheet delivery use the same isolated rendering boundary.
 */
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
 * The highlight layer mirrors the textarea contents.
 *
 * Token colors are resolved entirely through data attributes instead of
 * per-token inline styles. This keeps token rendering cheap and lets the
 * browser reuse the same CSS rules across every token node.
 */
export const MaquinaHighlight = styled.pre("MaquinaHighlight").css`
  position: absolute;
  inset: 0;
  z-index: 0;
  contain: paint;
  min-width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 14px 16px 26px;
  box-sizing: border-box;
  overflow: visible;
  pointer-events: none;
  user-select: none;
  white-space: pre;
  overflow-wrap: normal;
  font: 500 16px/1.55 var(
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

/**
 * The textarea is the editor's only scroll container.
 *
 * The runtime reads textarea.scrollTop/scrollLeft to translate the highlight
 * layer, so keeping scrolling here avoids competing scroll containers and
 * removes an unnecessary synchronization boundary.
 */
export const MaquinaInput = styled.textarea("MaquinaInput").css`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 14px 16px 26px;
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
  font: 500 16px/1.55 var(
    --maq-font,
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace
  );
  tab-size: var(--maq-tab-size, 2);
  white-space: pre;
  overflow-wrap: normal;
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
  min-width: 210px;
  max-width: min(420px, calc(100% - 24px));
  max-height: 240px;
  padding: 6px;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--maq-border);
  border-radius: 12px;
  background: var(--maq-surface);
  box-shadow: 0 18px 50px rgb(0 0 0 / 35%);

  &[hidden] {
    display: none;
  }
`;

/**
 * Individual suggestions intentionally avoid transitions, filters, and other
 * paint-heavy effects because keyboard navigation may update the active item
 * several times within a single animation frame.
 */
export const MaquinaSuggestion = styled.button("MaquinaSuggestion").css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  width: 100%;
  gap: 12px;
  margin: 0;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  appearance: none;
  background: transparent;
  color: var(--maq-foreground);
  text-align: left;
  font: inherit;
  cursor: default;

  &[data-active="true"],
  &:hover {
    background: color-mix(
      in srgb,
      var(--maq-accent) 18%,
      transparent
    );
  }

  & > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & > small {
    color: var(--maq-muted);
    white-space: nowrap;
  }
`;

/**
 * Flush only after every module-level styled component has been registered.
 *
 * Flushing immediately after connectRegistry() happens before these component
 * definitions exist, which can leave the initial registry flush empty.
 */
styled.flushRegistry();

/**
 * Collect style artifacts without flatMap/filter intermediate arrays.
 *
 * This only runs once at module initialization, so the absolute impact is
 * small, but the implementation stays allocation-conscious.
 */
const MAQUINA_STYLED_COMPONENTS = [
  MaquinaRoot,
  MaquinaViewport,
  MaquinaHighlight,
  MaquinaInput,
  MaquinaSuggestions,
  MaquinaSuggestion,
] as const;

export const maquinaStyleArtifacts = collectMaquinaStyleArtifacts();

function collectMaquinaStyleArtifacts() {
  const artifacts: Array<
    (typeof MAQUINA_STYLED_COMPONENTS)[number]["artifacts"][number]
  > = [];

  for (
    let componentIndex = 0;
    componentIndex < MAQUINA_STYLED_COMPONENTS.length;
    componentIndex += 1
  ) {
    const componentArtifacts =
      MAQUINA_STYLED_COMPONENTS[componentIndex].artifacts;

    for (
      let artifactIndex = 0;
      artifactIndex < componentArtifacts.length;
      artifactIndex += 1
    ) {
      const artifact = componentArtifacts[artifactIndex];

      if (artifact.kind === "cipo.css") {
        artifacts.push(artifact);
      }
    }
  }

  return artifacts;
}
