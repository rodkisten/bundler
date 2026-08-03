import type { CipoCssArtifact } from "@rodkisten/cipo";
import type { SourcesContextValue } from "@rodkisten/devtools/types";
import { component, event, html,  styled } from "@rodkisten/devtools/core/runtime";
import { icon } from "@rodkisten/devtools/utils";
import "@rodkisten/devtools/panels/shared-components";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";
import { filterArray, flatMap } from "@rodkisten/nascente";

export const SourcesContext = createRequiredFabricaContext<SourcesContextValue>("SourcesContext");

export const SourcesRoot = styled.div("RodSourcesRoot").css`
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: $background;
`;


export const SourcesIconButton = styled.button("RodSourcesIconButton").css`
  @with($control-reset)
  interactive-surface

  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  border: 0;
  border-radius: $control;
  color: $primary;
  background: transparent;
  cursor: pointer;
  transition: color .18s, background .18s, transform .1s;

  x:hover {
    color: $selectedForeground
    bg: $highlight
  }

  x:focus-visible {
    color: $selectedForeground
    bg: $highlight
  }

  x:active {
    transform: scale(.94)
    color: $accent
  }
`;

export const SourcesTitle = styled.div("RodSourcesTitle").css`
  min-width: 0;
  flex: 1;
  text(12px, ellipsis)
`;

export const SourcesBody = styled.div("RodSourcesBody").css`
  position: absolute;
  inset: $$controlHeight 0 0;
  width: auto;
  height: auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  touch-action: pan-y pan-x;
  -webkit-overflow-scrolling: touch;
`;

export const SourcesEmpty = styled.div("RodSourcesEmpty").css`
  display: grid;
  min-height: 180px;
  height: 100%;
  place-content: center;
  gap: 8px;
  padding: 24px;
  color: $foreground;
  text-align: center;

  strong { color: $primary; }
`;

export const SourcesPre = styled.pre("RodSourcesPre").css`
  margin: 0;
  padding: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  text(var(--rd-sources-font-size, 12px) / 1.5)
  font-family: $font.mono
  color: $foreground;
`;

export const SourcesEditor = styled.div("RodSourcesEditor").css`
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

export const SourcesBreadcrumb = styled.div("RodSourcesBreadcrumb").css`
  min-height: 28px;
  padding: 6px 10px;
  overflow-y: auto;
  overflow-x: hidden;
  border-bottom: 1px solid $border;
  color: $comment;
  background: $backgroundDark;
  text(11px / 1.4)
  font-family: $font.mono
  white-space: nowrap;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const SourcesCodeMirrorHost = styled.div("RodSourcesCodeMirrorHost").css`
  height: calc(100% - 28px);
  min-width: 0;
  min-height: 0;
  overflow: hidden;

  .cm-editor {
    height: 100%;
    background: $background;
    color: $foreground;
    outline: none;
  }
`;

export const SourcesObject = styled.div("RodSourcesObject").css`
  margin: 0;
  padding: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  text(var(--rd-sources-font-size, 12px) / 1.5)
  font-family: $font.mono
  color: $foreground;
`;

export const SourcesImage = styled.div("RodSourcesImage").css`
  display: grid;
  min-height: 240px;
  place-items: center;
  gap: 10px;
  padding: 12px;
  color: $foreground;

  img {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
  }
`;

export const SourcesIframe = styled.iframe("RodSourcesIframe").css`
  width: 100%;
  height: 100%;
  border: 0;
  background: white;
`;

export const SourcesLinkList = styled.ul("RodSourcesLinkList").css`
  margin: 0;
  padding: 8px 10px;
  list-style: none;

  li { padding: 5px 0; }
`;

export const SourcesTextButton = styled.button("RodSourcesTextButton").css`
  @with($control-reset)
  interactive-surface

  display: block;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: $sm;
  color: $primary;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;

  x:hover {
    color: $selectedForeground
    bg: $highlight
  }

  x:focus-visible {
    color: $selectedForeground
    bg: $highlight
  }
`;

const SOURCES_STYLED_COMPONENTS = Object.freeze([
  SourcesRoot,
  SourcesIconButton,
  SourcesTitle,
  SourcesBody,
  SourcesEmpty,
  SourcesPre,
  SourcesEditor,
  SourcesBreadcrumb,
  SourcesCodeMirrorHost,
  SourcesObject,
  SourcesImage,
  SourcesIframe,
  SourcesLinkList,
  SourcesTextButton,
]);

export const sourcesStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  filterArray(flatMap(SOURCES_STYLED_COMPONENTS, (styledComponent) => styledComponent.artifacts), (artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodSourcesView", function RodSourcesView(_props, ctx) {
  const sources = ctx.useRequiredContext(SourcesContext);

  return html`
    <RodSourcesRoot>
      <RodSharedControlBar>
        <RodSourcesIconButton type="button" title="Document source" @click=${event.click(() => sources.action("source-home"))}>⌂</RodSourcesIconButton>
        <RodSourcesIconButton type="button" title="All sources" @click=${event.click(() => sources.action("source-list"))}>☰</RodSourcesIconButton>
        <RodSourcesTitle :sourceTitle>${sources.title}</RodSourcesTitle>
        <RodSourcesIconButton type="button" title="Copy" @click=${event.click(() => sources.action("source-copy"))}>${icon("copy")}</RodSourcesIconButton>
        <RodSourcesIconButton type="button" title="Download" @click=${event.click(() => sources.action("source-download"))}>${icon("download")}</RodSourcesIconButton>
        <RodSourcesIconButton type="button" title="Refresh" @click=${event.click(() => sources.action("source-refresh"))}>${icon("refresh")}</RodSourcesIconButton>
      </RodSharedControlBar>
      <RodSourcesBody :sourcesBody>${sources.content}</RodSourcesBody>
    </RodSourcesRoot>
  `;
});
