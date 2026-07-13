import type { CipoCssArtifact } from "../../cipo";
import type { SnippetItem } from "../types";
import { component, event, html,  styled } from "../core/runtime";
import "./shared-components";

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

export const SnippetsTitle = styled.span("RodSnippetsTitle").css`
  flex: 1 1 auto;
  min-width: 0;
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
  SnippetsTitle,
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
    <RodSharedPanelRoot>
      <RodSharedHeader>
        <RodSnippetsTitle>Snippets</RodSnippetsTitle>
        <RodSharedActions>
          <RodSharedButton type="button" @click=${event.click(() => view.add())}>Add</RodSharedButton>
          <RodSharedButton type="button" @click=${event.click(() => view.reset())}>Reset</RodSharedButton>
        </RodSharedActions>
      </RodSharedHeader>
      <RodSharedPanelBody data-snippets-body ref=${(node) => {
        view.setBody(node);
        return () => view.setBody(null);
      }}>
        ${model.snippets.length ? model.snippets.map((snippet, index) => {
          const active = model.activeNames.has(snippet.name);
          return html`
            <RodSharedCard>
              <RodSnippetName>${active ? "● " : ""}${snippet.name}</RodSnippetName>
              <RodSnippetDescription>${snippet.description}</RodSnippetDescription>
              <RodSharedActions>
                <RodSharedButton type="button" @click=${event.click(() => view.run(index))}>${active ? "Stop" : "Run"}</RodSharedButton>
                <RodSharedButton type="button" @click=${event.click(() => view.remove(index))}>Remove</RodSharedButton>
              </RodSharedActions>
            </RodSharedCard>
          `;
        }) : html`<RodSharedEmptyState>No snippets registered.</RodSharedEmptyState>`}
      </RodSharedPanelBody>
    </RodSharedPanelRoot>
  `;
});
