import type { CipoCssArtifact } from "../../cipo";
import type { RenderValue } from "../../fabrica";
import { icon, truncate } from "../core/dom";
import { component, html, ref, styled } from "../components/runtime";

export type RenderPiece = RenderValue;
export type StorageType = "local" | "session";

export interface ResourcesViewModel {
  setBody(node: HTMLElement | null): void;
}

export type StorageRowModel = {
  type: StorageType;
  key: string;
  value: string;
  json: boolean;
};

export type CookieModel = {
  name: string;
  value: string;
};

export type CapabilityModel = {
  name: string;
  available: boolean;
};

const ResourcesBody = styled.div("RodResourcesBody").css`
  height: 100%;
  padding-bottom: $$safeBottom;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const ResourcesSection = styled.section("RodResourcesSection").css`
  margin: 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $md;
  background: $background;
`;

const ResourcesSectionTitle = styled.div("RodResourcesSectionTitle").css`
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

const ResourcesSectionActions = styled.span("RodResourcesSectionActions").css`
  display: flex;
  gap: 4px;
  margin-left: auto;
`;

const ResourcesIconButton = styled.button("RodResourcesIconButton").css`
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

const ResourcesTableWrap = styled.div("RodResourcesTableWrap").css`
  width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const ResourcesTable = styled.table("RodResourcesTable").css`
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  color: $foreground;
  font-size: 12px;

  th,
  td {
    padding: 7px 8px;
    border-bottom: 1px solid $border;
    text-align: left;
    vertical-align: middle;
  }

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

const ResourcesInput = styled.input("RodResourcesInput").css`
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

const ResourcesLinkList = styled.ul("RodResourcesLinkList").css`
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

const ResourcesSectionContent = styled.div("RodResourcesSectionContent").css`
  padding: 10px;
`;

const ResourcesImageList = styled.div("RodResourcesImageList").css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
  gap: 8px;
`;

const ResourcesImageCard = styled.button("RodResourcesImageCard").css`
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

export function resourcesTemplate(sections: RenderPiece[]): RenderPiece {
  return html`${sections}`;
}

export function storageSectionTemplate(title: string, type: StorageType, rows: StorageRowModel[]): RenderPiece {
  return html`
    <RodResourcesSection>
      <RodResourcesSectionTitle>
        <span>${title} (${rows.length})</span>
        <RodResourcesSectionActions>
          <RodResourcesIconButton type="button" data-resource-action="refresh" title="Refresh">${icon("refresh")}</RodResourcesIconButton>
          <RodResourcesIconButton type="button" data-resource-action="add-storage" data-storage-type=${type} title="Add">+</RodResourcesIconButton>
          <RodResourcesIconButton type="button" data-resource-action="clear-storage" data-storage-type=${type} title="Clear">${icon("clear")}</RodResourcesIconButton>
        </RodResourcesSectionActions>
      </RodResourcesSectionTitle>

      <RodResourcesTableWrap>
        <RodResourcesTable>
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(storageRowTemplate) : html`<tr><td colspan="3">Empty</td></tr>`}
          </tbody>
        </RodResourcesTable>
      </RodResourcesTableWrap>
    </RodResourcesSection>
  `;
}

function storageRowTemplate(row: StorageRowModel): RenderPiece {
  return html`
    <tr data-storage-type=${row.type} data-original-key=${row.key}>
      <td><RodResourcesInput data-storage-key .value=${row.key} /></td>
      <td><RodResourcesInput data-storage-value .value=${row.json ? formatJsonValue(row.value) : row.value} /></td>
      <td>
        ${row.json ? html`
          <RodResourcesIconButton
            type="button"
            data-resource-action="edit-json-storage"
            data-storage-type=${row.type}
            data-storage-key=${row.key}
            title="Edit JSON"
          >
            { }
          </RodResourcesIconButton>
        ` : ""}
        <RodResourcesIconButton
          type="button"
          data-resource-action="remove-storage"
          data-storage-type=${row.type}
          data-storage-key=${row.key}
          title="Remove"
        >
          ×
        </RodResourcesIconButton>
      </td>
    </tr>
  `;
}

export function cookieSectionTemplate(cookies: CookieModel[]): RenderPiece {
  return html`
    <RodResourcesSection>
      <RodResourcesSectionTitle>
        <span>Cookies (${cookies.length})</span>
        <RodResourcesSectionActions>
          <RodResourcesIconButton type="button" data-resource-action="add-cookie" title="Add">+</RodResourcesIconButton>
          <RodResourcesIconButton type="button" data-resource-action="refresh" title="Refresh">${icon("refresh")}</RodResourcesIconButton>
        </RodResourcesSectionActions>
      </RodResourcesSectionTitle>

      <RodResourcesTableWrap>
        <RodResourcesTable>
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${cookies.length ? cookies.map((cookie) => html`
              <tr>
                <td>${cookie.name}</td>
                <td>${cookie.value}</td>
                <td>
                  <RodResourcesIconButton
                    type="button"
                    data-resource-action="remove-cookie"
                    data-cookie-name=${cookie.name}
                    title="Remove"
                  >
                    ×
                  </RodResourcesIconButton>
                </td>
              </tr>
            `) : html`<tr><td colspan="3">No script-visible cookies</td></tr>`}
          </tbody>
        </RodResourcesTable>
      </RodResourcesTableWrap>
    </RodResourcesSection>
  `;
}

export function capabilitySectionTemplate(items: CapabilityModel[]): RenderPiece {
  return html`
    <RodResourcesSection>
      <RodResourcesSectionTitle>
        <span>Storage capabilities</span>
        <RodResourcesSectionActions>
          <RodResourcesIconButton type="button" data-resource-action="refresh" title="Refresh">${icon("refresh")}</RodResourcesIconButton>
        </RodResourcesSectionActions>
      </RodResourcesSectionTitle>

      <RodResourcesLinkList>
        ${items.map((item) => html`
          <li>${item.name}: ${item.available ? "available" : "unavailable"}</li>
        `)}
      </RodResourcesLinkList>
    </RodResourcesSection>
  `;
}

export function linkSectionTemplate(title: string, type: string, urls: string[]): RenderPiece {
  return html`
    <RodResourcesSection>
      <RodResourcesSectionTitle>
        <span>${title} (${urls.length})</span>
        <RodResourcesSectionActions>
          <RodResourcesIconButton type="button" data-resource-action="refresh" title="Refresh">${icon("refresh")}</RodResourcesIconButton>
        </RodResourcesSectionActions>
      </RodResourcesSectionTitle>

      <RodResourcesLinkList>
        ${urls.length ? urls.map((url) => html`
          <li>
            <a href=${url} data-source-type=${type} data-url=${url}>${url}</a>
          </li>
        `) : html`<li>None</li>`}
      </RodResourcesLinkList>
    </RodResourcesSection>
  `;
}

export function imageSectionTemplate(urls: string[]): RenderPiece {
  return html`
    <RodResourcesSection>
      <RodResourcesSectionTitle>
        <span>Images (${urls.length})</span>
        <RodResourcesSectionActions>
          <RodResourcesIconButton type="button" data-resource-action="refresh" title="Refresh">${icon("refresh")}</RodResourcesIconButton>
        </RodResourcesSectionActions>
      </RodResourcesSectionTitle>

      <RodResourcesSectionContent>
        <RodResourcesImageList>
          ${urls.length ? urls.slice(0, 500).map((url) => html`
            <RodResourcesImageCard type="button" data-source-type="image" data-url=${url}>
              <img src=${url} loading="lazy" alt="" />
              <span title=${url}>${truncate(url, 100)}</span>
            </RodResourcesImageCard>
          `) : "None"}
        </RodResourcesImageList>
      </RodResourcesSectionContent>
    </RodResourcesSection>
  `;
}

export function storageRows(type: StorageType, storage: Storage): StorageRowModel[] {
  const rows: StorageRowModel[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key == null) continue;

    const value = storage.getItem(key) ?? "";

    rows.push({
      type,
      key,
      value,
      json: isJsonValue(value),
    });
  }

  return rows;
}

export function capabilityItems(): CapabilityModel[] {
  return [
    ["IndexedDB", typeof indexedDB !== "undefined"],
    ["Cache Storage", typeof caches !== "undefined"],
    ["WebSQL", typeof (window as unknown as { openDatabase?: unknown }).openDatabase === "function"],
    ["localStorage", canUseStorage("local")],
    ["sessionStorage", canUseStorage("session")],
    ["Cookies", typeof document.cookie === "string"],
  ].map(([name, available]) => ({
    name: String(name),
    available: Boolean(available),
  }));
}

export function isJsonValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function formatJsonValue(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function canUseStorage(type: StorageType): boolean {
  try {
    const storage = type === "local" ? localStorage : sessionStorage;
    const key = "__roderuda_storage_probe__";

    storage.setItem(key, "1");
    storage.removeItem(key);

    return true;
  } catch {
    return false;
  }
}
