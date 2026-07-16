import type { CipoCssArtifact } from "@rodkisten/cipo";
import type { SnippetsContextValue } from "@rodkisten/devtools/types";
import { component, event, html, repeat, styled } from "@rodkisten/devtools/core/runtime";
import "@rodkisten/devtools/panels/shared-components";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";

export const SnippetsContext = createRequiredFabricaContext<SnippetsContextValue>("SnippetsContext");

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

component("RodSnippetsView", function RodSnippetsView(_props, ctx) {
  const snippets = ctx.useRequiredContext(SnippetsContext);

  return html`
    <RodSharedPanelRoot>
      <RodSharedHeader>
        <RodSnippetsTitle>Snippets</RodSnippetsTitle>
        <RodSharedActions>
          <RodSharedButton type="button" @click=${event.click(() => snippets.add())}>Add</RodSharedButton>
          <RodSharedButton type="button" @click=${event.click(() => snippets.reset())}>Reset</RodSharedButton>
        </RodSharedActions>
      </RodSharedHeader>
      <RodSharedPanelBody :snippetsBody>
        ${repeat(
          snippets.snippets,
          (snippet) => snippet.name,
          ({ item }) => {
            const active = () => snippets.activeNames().has(item().name);
            return html`
              <RodSharedCard>
                <RodSnippetName>${() => active() ? "● " : ""}${() => item().name}</RodSnippetName>
                <RodSnippetDescription>${() => item().description}</RodSnippetDescription>
                <RodSharedActions>
                  <RodSharedButton type="button" @click=${event.click(() => snippets.run(item().name))}>${() => active() ? "Stop" : "Run"}</RodSharedButton>
                  <RodSharedButton type="button" @click=${event.click(() => snippets.remove(item().name))}>Remove</RodSharedButton>
                </RodSharedActions>
              </RodSharedCard>
            `;
          },
          { empty: () => html`<RodSharedEmptyState>No snippets registered.</RodSharedEmptyState>` },
        )}
      </RodSharedPanelBody>
    </RodSharedPanelRoot>
  `;
});
