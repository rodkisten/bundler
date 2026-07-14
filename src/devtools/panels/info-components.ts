import type { CipoCssArtifact } from "../../cipo";
import type { RenderValue } from "../../fabrica";
import { component, event, html,  styled } from "../core/runtime";
import "./shared-components";
import { createRequiredFabricaContext } from "../../fabrica";

export type InfoModel = {
  items: Array<{ name: string; value: unknown }>;
};

export interface InfoViewModel {
  model(): InfoModel;
  setRoot(node: HTMLElement | null): void;
  refresh(): void;
  copyAll(): void;
  copyItem(index: number): void;
  renderValue(value: unknown): RenderValue;
}

export const InfoViewContext = createRequiredFabricaContext<InfoViewModel>("InfoViewContext");



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
  const view = ctx.useRequiredContext(InfoViewContext);
  const model = view.model();

  return html`
    <RodSharedPanelRoot ref=${(node) => {
      view.setRoot(node);
      return () => view.setRoot(null);
    }}>
      <RodSharedHeader>
        <RodInfoTitle>Page information</RodInfoTitle>
        <RodSharedActions>
          <RodSharedButton type="button" @click=${event.click((click) => { click.preventDefault(); view.refresh(); })}>Refresh</RodSharedButton>
          <RodSharedButton type="button" @click=${event.click((click) => { click.preventDefault(); view.copyAll(); })}>Copy all</RodSharedButton>
        </RodSharedActions>
      </RodSharedHeader>
      <RodSharedPanelBody :infoBody>
        ${model.items.length ? model.items.map((item, index) => html`
          <RodSharedCard>
            <RodSharedHeader>
              <RodInfoTitle>${item.name}</RodInfoTitle>
              <RodSharedButton type="button" @click=${event.click((click) => { click.preventDefault(); view.copyItem(index); })}>Copy</RodSharedButton>
            </RodSharedHeader>
            <RodInfoCardContent>${view.renderValue(item.value)}</RodInfoCardContent>
          </RodSharedCard>
        `) : html`<RodSharedEmptyState>No information registered.</RodSharedEmptyState>`}
      </RodSharedPanelBody>
    </RodSharedPanelRoot>
  `;
});
