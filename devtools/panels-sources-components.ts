import { component, event, html,  styled } from "@rodkisten/devtools/core-runtime";
import { icon } from "@rodkisten/devtools/utils";
import "@rodkisten/devtools/panels-shared-components";
import { createRequiredFabricaContext } from "@rodkisten/fabrica/runtime";

export interface SourcesViewModel {
  readonly title: string;
  setBody(node: HTMLElement | null): void;
  action(name: string): void;
}

export const SourcesViewContext = createRequiredFabricaContext<SourcesViewModel>("SourcesViewContext");

export const SourcesRoot = styled.div("RodSourcesRoot").css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $background;
`;


export const SourcesIconButton = styled.button("RodSourcesIconButton", {
  attrs: (props) => ({
    type: 'button',
    'aria-label': props.label,
  })}).css`
  appearance: none;
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

  &:hover,
  &:focus-visible {
    color: $selectedForeground;
    background: $highlight;
  }

  &:active {
    transform: scale(.94);
    color: $accent;
  }
`;

export const SourcesTitle = styled.div("RodSourcesTitle").css`
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
`;

export const SourcesBody = styled.div("RodSourcesBody").css`
  width: 100%;
  height: 100%;
  padding-top: $$controlHeight;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
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
  font: var(--rd-sources-font-size, 12px) / 1.5 $font.mono;
  color: $foreground;
`;

export const SourcesEditor = styled.div("RodSourcesEditor").css`
  height: 100%;
  min-width: 0;
`;

export const SourcesBreadcrumb = styled.div("RodSourcesBreadcrumb").css`
  min-height: 28px;
  padding: 6px 10px;
  overflow-y: auto;
  overflow-x: hidden;
  border-bottom: 1px solid $border;
  color: $comment;
  background: $backgroundDark;
  font: 11px / 1.4 $font.mono;
  white-space: nowrap;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const SourcesCodeMirrorHost = styled.div("RodSourcesCodeMirrorHost").css`
  height: calc(100% - 28px);
  min-width: 0;

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
  font: var(--rd-sources-font-size, 12px) / 1.5 $font.mono;
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
  appearance: none;
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

  &:hover,
  &:focus-visible {
    color: $selectedForeground;
    background: $highlight;
  }
`;


component("RodSourcesView", function RodSourcesView(_props, ctx) {
  const view = ctx.useRequiredContext(SourcesViewContext);
  const { title } = view;

  return html`
    <RodSourcesRoot>
      <RodSharedControlBar>
        <RodSourcesIconButton title="Document source" @click=${event.click(() => view.action("source-home"))}>⌂</RodSourcesIconButton>
        <RodSourcesIconButton type="button" title="All sources" @click=${event.click(() => view.action("source-list"))}>☰</RodSourcesIconButton>
        <RodSourcesTitle :sourceTitle>${title}</RodSourcesTitle>
        <RodSourcesIconButton title="Copy" @click=${event.click(() => view.action("source-copy"))}>${icon("copy")}</RodSourcesIconButton>
        <RodSourcesIconButton title="Download" @click=${event.click(() => view.action("source-download"))}>${icon("download")}</RodSourcesIconButton>
        <RodSourcesIconButton title="Refresh" @click=${event.click(() => view.action("source-refresh"))}>${icon("refresh")}</RodSourcesIconButton>
      </RodSharedControlBar>
      <RodSourcesBody :sourcesBody ref=${(node: HTMLElement) => {
        view.setBody(node);
        return () => view.setBody(null);
      }} />
    </RodSourcesRoot>
  `;
});
