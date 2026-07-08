import type { CipoCssArtifact } from "../../cipo";
import type { SnippetItem } from "../types";
import { component, event, html, ref, styled } from "../components/runtime";

export type SnippetsModel = {
  snippets: SnippetItem[];
  activeNames: Set<string>;
};

export interface SnippetsViewModel {
  model(): SnippetsModel;
  setBody(node: HTMLElement | null): void;
  add(): void;
  reset(): void;
  run(index: number): void;
  remove(index: number): void;
}

export const SnippetsRoot = styled.section("RodSnippetsRoot").css`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $background;
`;

export const SnippetsHeader = styled.header("RodSnippetsHeader").css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 9px 10px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-weight: 600;
`;

export const SnippetsTitle = styled.span("RodSnippetsTitle").css`
  flex: 1 1 auto;
  min-width: 0;
`;

export const SnippetsActions = styled.div("RodSnippetsActions").css`
  display: flex;
  gap: 4px;
`;

export const SnippetsButton = styled.button("RodSnippetsButton").css`
  appearance: none;
  min-width: 28px;
  min-height: 28px;
  padding: 4px 8px;
  border: 0;
  border-radius: $control;
  color: $primary;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color .18s, background .18s, transform .1s;

  &:hover,
  &:focus-visible {
    color: $selectedForeground;
    background: $highlight;
  }

  &:active {
    transform: scale(.96);
    color: $accent;
  }
`;

export const SnippetsBody = styled.div("RodSnippetsBody").css`
  width: 100%;
  height: calc(100% - 38px);
  overflow: auto;
  padding-bottom: $$safeBottom;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const SnippetsEmpty = styled.div("RodSnippetsEmpty").css`
  display: grid;
  min-height: 180px;
  place-content: center;
  padding: 24px;
  color: $foreground;
  text-align: center;
`;

export const SnippetCard = styled.article("RodSnippetCard").css`
  margin: 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $section;
  background: $background;
`;

export const SnippetName = styled.div("RodSnippetName").css`
  min-height: 38px;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: $primary;
  background: $backgroundDark;
  border-bottom: 1px solid $border;
  font-weight: 600;
`;

export const SnippetDescription = styled.div("RodSnippetDescription").css`
  padding: 10px;
  color: $foreground;
  word-break: break-word;
`;

const SNIPPETS_STYLED_COMPONENTS = Object.freeze([
  SnippetsRoot,
  SnippetsHeader,
  SnippetsTitle,
  SnippetsActions,
  SnippetsButton,
  SnippetsBody,
  SnippetsEmpty,
  SnippetCard,
  SnippetName,
  SnippetDescription,
]);

export const snippetsStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  SNIPPETS_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodSnippetsView", function RodSnippetsView(props) {
  const view = props.view as SnippetsViewModel;
  const model = view.model();

  return html`
    <RodSnippetsRoot>
      <RodSnippetsHeader>
        <RodSnippetsTitle>Snippets</RodSnippetsTitle>
        <RodSnippetsActions>
          <RodSnippetsButton type="button" @click=${event(() => view.add())}>Add</RodSnippetsButton>
          <RodSnippetsButton type="button" @click=${event(() => view.reset())}>Reset</RodSnippetsButton>
        </RodSnippetsActions>
      </RodSnippetsHeader>
      <RodSnippetsBody data-snippets-body ref=${ref<HTMLElement>((node) => {
        view.setBody(node);
        return () => view.setBody(null);
      })}>
        ${model.snippets.length ? model.snippets.map((snippet, index) => {
          const active = model.activeNames.has(snippet.name);
          return html`
            <RodSnippetCard>
              <RodSnippetName>${active ? "● " : ""}${snippet.name}</RodSnippetName>
              <RodSnippetDescription>${snippet.description}</RodSnippetDescription>
              <RodSnippetsActions>
                <RodSnippetsButton type="button" @click=${event(() => view.run(index))}>${active ? "Stop" : "Run"}</RodSnippetsButton>
                <RodSnippetsButton type="button" @click=${event(() => view.remove(index))}>Remove</RodSnippetsButton>
              </RodSnippetsActions>
            </RodSnippetCard>
          `;
        }) : html`<RodSnippetsEmpty>No snippets registered.</RodSnippetsEmpty>`}
      </RodSnippetsBody>
    </RodSnippetsRoot>
  `;
});
