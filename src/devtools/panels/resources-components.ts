import type { CipoCssArtifact } from "../../cipo";
import { component, html, ref, styled } from "../components/runtime";

export interface ResourcesViewModel {
  setBody(node: HTMLElement | null): void;
}

export const ResourcesBody = styled.div("RodResourcesBody").css`
  height: 100%;
  padding-bottom: $$safeBottom;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const ResourcesSection = styled.section("RodResourcesSection").css`
  margin: 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $md;
  background: $background;
`;

export const ResourcesSectionTitle = styled.div("RodResourcesSectionTitle").css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 8px 10px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-weight: 600;
`;

export const ResourcesSectionActions = styled.span("RodResourcesSectionActions").css`
  display: flex;
  gap: 4px;
  margin-left: auto;
`;

export const ResourcesIconButton = styled.button("RodResourcesIconButton").css`
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
  font: inherit;
  font-size: 16px;
  cursor: pointer;
  transition: color .18s, background .18s, transform .1s;

  &:hover {
    color: $selectedForeground;
    background: $highlight;
  }

  &:active {
    transform: scale(.94);
    color: $accent;
  }
`;

export const ResourcesTableWrap = styled.div("RodResourcesTableWrap").css`
  width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

export const ResourcesTable = styled.table("RodResourcesTable").css`
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  color: $foreground;
  font-size: 12px;

  th { padding: 7px 8px; border-bottom: 1px solid $border; text-align: left; vertical-align: middle; }
  td { padding: 7px 8px; border-bottom: 1px solid $border; text-align: left; vertical-align: middle; }

  th {
    color: $primary;
    background: $backgroundDark;
    font-weight: 600;
  }

  td:last-child {
    width: 78px;
    white-space: nowrap;
  }
`;

export const ResourcesInput = styled.input("RodResourcesInput").css`
  width: 100%;
  min-width: 0;
  padding: 5px 7px;
  border: 1px solid $border;
  border-radius: $sm;
  color: $primary;
  background: $background;
  font: inherit;
  user-select: text;
`;

export const ResourcesLinkList = styled.ul("RodResourcesLinkList").css`
  margin: 0;
  padding: 8px 10px;
  list-style: none;

  li {
    padding: 5px 0;
    color: $foreground;
    word-break: break-all;
  }

  a {
    color: $accent;
    text-decoration: none;
  }
`;

export const ResourcesSectionContent = styled.div("RodResourcesSectionContent").css`
  padding: 10px;
`;

export const ResourcesImageList = styled.div("RodResourcesImageList").css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
  gap: 8px;
`;

export const ResourcesImageCard = styled.button("RodResourcesImageCard").css`
  appearance: none;
  display: grid;
  gap: 6px;
  padding: 7px;
  border: 1px solid $border;
  border-radius: $md;
  color: $foreground;
  background: $backgroundDark;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: $highlight;
  }

  img {
    width: 100%;
    height: 78px;
    object-fit: cover;
    border-radius: $sm;
    background: $background;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const RESOURCES_STYLED_COMPONENTS = Object.freeze([
  ResourcesBody,
  ResourcesSection,
  ResourcesSectionTitle,
  ResourcesSectionActions,
  ResourcesIconButton,
  ResourcesTableWrap,
  ResourcesTable,
  ResourcesInput,
  ResourcesLinkList,
  ResourcesSectionContent,
  ResourcesImageList,
  ResourcesImageCard,
]);

export const resourcesStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  RESOURCES_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodResourcesView", function RodResourcesView(props) {
  const view = props.view as ResourcesViewModel;

  return html`
    <RodResourcesBody
      data-resources-body
      ref=${ref((node) => {
        view.setBody(node as HTMLElement);
        return () => view.setBody(null);
      })}
    />
  `;
});
