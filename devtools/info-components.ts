import type { CipoCssArtifact } from "@rodkisten/cipo";
import type { InfoContextValue } from "@rodkisten/devtools/types";
import { component, event, html, repeat, styled } from "@rodkisten/devtools/core/runtime";
import "@rodkisten/devtools/panels/shared-components";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";

export const InfoContext = createRequiredFabricaContext<InfoContextValue>("InfoContext");



export const InfoTitle = styled.span("RodInfoTitle").css`
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;







export const InfoCardContent = styled.div("RodInfoCardContent").css`
  padding: 10px;
  color: $foreground;
  word-break: break-word;
  user-select: text;
`;

export const InfoKv = styled.div("RodInfoKv").css`
  display: grid;
  grid-template-columns: minmax(95px, .4fr) minmax(130px, 1fr);
  gap: 0;
  font-size: 12px;
`;

export const InfoKey = styled.div("RodInfoKey").css`
  padding: 6px 8px;
  border-bottom: 1px solid $border;
  color: $attr;
  word-break: break-word;
`;

export const InfoValue = styled.div("RodInfoValue").css`
  padding: 6px 8px;
  border-bottom: 1px solid $border;
  color: $foreground;
  word-break: break-word;
`;

const INFO_STYLED_COMPONENTS = Object.freeze([
  InfoTitle,
  InfoCardContent,
  InfoKv,
  InfoKey,
  InfoValue,
]);

export const infoStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  INFO_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodInfoView", function RodInfoView(_props, ctx) {
  const info = ctx.requireContext(InfoContext);

  return html`
    <RodSharedPanelRoot>
      <RodSharedHeader>
        <RodInfoTitle>Page information</RodInfoTitle>
        <RodSharedActions>
          <RodSharedButton type="button" @click=${event.click((click) => { click.preventDefault(); info.refresh(); })}>Refresh</RodSharedButton>
          <RodSharedButton type="button" @click=${event.click((click) => { click.preventDefault(); info.copyAll(); })}>Copy all</RodSharedButton>
        </RodSharedActions>
      </RodSharedHeader>
      <RodSharedPanelBody :infoBody>
        ${repeat(
          () => info.model().items,
          (item) => item.name,
          ({ item }) => html`
            <RodSharedCard>
              <RodSharedHeader>
                <RodInfoTitle>${() => item().name}</RodInfoTitle>
                <RodSharedButton type="button" @click=${event.click((click) => { click.preventDefault(); info.copyItem(item().name); })}>Copy</RodSharedButton>
              </RodSharedHeader>
              <RodInfoCardContent>${() => info.renderValue(item().value)}</RodInfoCardContent>
            </RodSharedCard>
          `,
          { empty: () => html`<RodSharedEmptyState>No information registered.</RodSharedEmptyState>` },
        )}
      </RodSharedPanelBody>
    </RodSharedPanelRoot>
  `;
});
