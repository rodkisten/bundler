import type { CipoCssArtifact } from "@rodkisten/cipo";
import type { ResourcesContextValue } from "@rodkisten/devtools/types";
import { component, html,  styled } from "@rodkisten/devtools/core/runtime";
import "@rodkisten/devtools/panels/shared-components";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";
import { filterArray, flatMap } from "@rodkisten/nascente";

export const ResourcesContext = createRequiredFabricaContext<ResourcesContextValue>("ResourcesContext");

export const ResourcesSection = styled.section("RodResourcesSection").css`
  margin: 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $section;
  background: $background;
`;

export const ResourcesTableWrap = styled.div("RodResourcesTableWrap").css`
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
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


export const ResourcesJsonDialog = styled.div("RodResourcesJsonDialog").css`
  position: absolute;
  inset: 8px;
  z-index: var(--rd-z-modal, 2147483570);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $section;
  background: $background;
  box-shadow: 0 18px 60px rgb(0 0 0 / .45);
`;

export const ResourcesJsonHeader = styled.div("RodResourcesJsonHeader").css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 10px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-weight: 700;
`;

export const ResourcesJsonEditorHost = styled.div("RodResourcesJsonEditorHost").css`
  min-height: 0;
  overflow: hidden;

  .cm-editor,
  .cm-scroller {
    height: 100%;
  }
`;

export const ResourcesJsonActions = styled.div("RodResourcesJsonActions").css`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 10px calc(var(--rd-resources-bottom-padding, 96px) + var(--rd-safe-bottom));
  border-top: 1px solid $border;
  background: $backgroundDark;
`;

const RESOURCES_STYLED_COMPONENTS = Object.freeze([
  ResourcesSection,
  ResourcesTableWrap,
  ResourcesSectionTitle,
  ResourcesSectionActions,
  ResourcesIconButton,
  ResourcesTable,
  ResourcesInput,
  ResourcesLinkList,
  ResourcesSectionContent,
  ResourcesImageList,
  ResourcesImageCard,
  ResourcesJsonDialog,
  ResourcesJsonHeader,
  ResourcesJsonEditorHost,
  ResourcesJsonActions,
]);

export const resourcesStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  filterArray(flatMap(RESOURCES_STYLED_COMPONENTS, (styledComponent) => styledComponent.artifacts), (artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodResourcesView", function RodResourcesView(_props, ctx) {
  const resources = ctx.useRequiredContext(ResourcesContext);

  return html`
    <RodSharedScrollableBody :resourcesBody>
      ${() => {
        resources.revision();
        return resources.renderContent();
      }}
    </RodSharedScrollableBody>
    ${() => resources.renderJsonDialog()}
  `;
});
