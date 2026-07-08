import type { CipoCssArtifact } from "../../cipo";
import type { RenderValue } from "../../fabrica";
import { component, event, html, ref, styled } from "../components/runtime";

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

export const InfoRoot = styled.section("RodInfoRoot").css`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $background;
`;

export const InfoHeader = styled.header("RodInfoHeader").css`
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

export const InfoTitle = styled.span("RodInfoTitle").css`
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const InfoActions = styled.div("RodInfoActions").css`
  display: flex;
  gap: 4px;
`;

export const InfoButton = styled.button("RodInfoButton").css`
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

export const InfoBody = styled.div("RodInfoBody").css`
  width: 100%;
  height: calc(100% - 38px);
  overflow: auto;
  padding-bottom: $$safeBottom;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const InfoEmpty = styled.div("RodInfoEmpty").css`
  display: grid;
  min-height: 180px;
  place-content: center;
  padding: 24px;
  color: $foreground;
  text-align: center;
`;

export const InfoCard = styled.article("RodInfoCard").css`
  margin: 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $section;
  background: $background;
`;

export const InfoCardTitle = styled.header("RodInfoCardTitle").css`
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
  InfoRoot,
  InfoHeader,
  InfoTitle,
  InfoActions,
  InfoButton,
  InfoBody,
  InfoEmpty,
  InfoCard,
  InfoCardTitle,
  InfoCardContent,
  InfoKv,
  InfoKey,
  InfoValue,
]);

export const infoStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  INFO_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodInfoView", function RodInfoView(props) {
  const view = props.view as InfoViewModel;
  const model = view.model();

  return html`
    <RodInfoRoot ref=${ref<HTMLElement>((node) => {
      view.setRoot(node);
      return () => view.setRoot(null);
    })}>
      <RodInfoHeader>
        <RodInfoTitle>Page information</RodInfoTitle>
        <RodInfoActions>
          <RodInfoButton type="button" @click=${event((click: Event) => { click.preventDefault(); view.refresh(); })}>Refresh</RodInfoButton>
          <RodInfoButton type="button" @click=${event((click: Event) => { click.preventDefault(); view.copyAll(); })}>Copy all</RodInfoButton>
        </RodInfoActions>
      </RodInfoHeader>
      <RodInfoBody data-info-body>
        ${model.items.length ? model.items.map((item, index) => html`
          <RodInfoCard>
            <RodInfoCardTitle>
              <RodInfoTitle>${item.name}</RodInfoTitle>
              <RodInfoButton type="button" @click=${event((click: Event) => { click.preventDefault(); view.copyItem(index); })}>Copy</RodInfoButton>
            </RodInfoCardTitle>
            <RodInfoCardContent>${view.renderValue(item.value)}</RodInfoCardContent>
          </RodInfoCard>
        `) : html`<RodInfoEmpty>No information registered.</RodInfoEmpty>`}
      </RodInfoBody>
    </RodInfoRoot>
  `;
});
