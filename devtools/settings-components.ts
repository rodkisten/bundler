import type { CipoCssArtifact } from "@rodkisten/cipo";
import type { SettingsContextValue } from "@rodkisten/devtools/types";
import { component, html, repeat, styled } from "@rodkisten/devtools/core/runtime";
import "@rodkisten/devtools/panels/shared-components";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";
import { filterArray, flatMap } from "@rodkisten/nascente";

export const SettingsContext = createRequiredFabricaContext<SettingsContextValue>("SettingsContext");

export const SettingsSection = styled.section("RodSettingsSection").css`
  margin: 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $section;
  background: $background;
`;

export const SettingsSectionTitle = styled.div("RodSettingsSectionTitle").css`
  min-height: 38px;
  padding: 9px 10px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-weight: 600;

  position: sticky;
`;

export const SettingsRow = styled.label("RodSettingsRow").css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 42px;
  padding: 9px 10px;
  border-bottom: 1px solid $border;
  color: $foreground;

  &:last-child {
    border-bottom: 0;
  }
`;

export const SettingsText = styled.div("RodSettingsText").css`
  min-width: 0;
  color: $primary;
  font-size: 12px;
`;

export const SettingsSeparator = styled.div("RodSettingsSeparator").css`
  height: 9px;
`;

export const SettingsButton = styled.button("RodSettingsButton").css`
  appearance: none;
  min-height: 28px;
  padding: 5px 9px;
  border: 1px solid $border;
  border-radius: $control;
  color: $primary;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: $selectedForeground;
    background: $highlight;
  }
`;

export const SettingsInput = styled.input("RodSettingsInput").css`
  min-width: 80px;
  padding: 5px 7px;
  border: 1px solid $border;
  border-radius: $sm;
  color: $primary;
  background: $background;
  font: inherit;
  font-size: 12px;
`;

export const SettingsSelect = styled.select("RodSettingsSelect").css`
  min-width: 130px;
  max-width: 46vw;
  padding: 5px 7px;
  border: 1px solid $border;
  border-radius: $sm;
  color: $primary;
  background: $background;
  font: inherit;
  font-size: 12px;
`;

const SETTINGS_STYLED_COMPONENTS = Object.freeze([
  SettingsSection,
  SettingsSectionTitle,
  SettingsRow,
  SettingsText,
  SettingsSeparator,
  SettingsButton,
  SettingsInput,
  SettingsSelect,
]);

export const settingsStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  filterArray(flatMap(SETTINGS_STYLED_COMPONENTS, (styledComponent) => styledComponent.artifacts), (artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodSettingsView", function RodSettingsView(_props, ctx) {
  const settings = ctx.useRequiredContext(SettingsContext);

  return html`
    <RodSharedScrollableBody :settingsBody>
      <RodSettingsSection>
        <RodSettingsSectionTitle>Settings</RodSettingsSectionTitle>
        ${repeat(
          settings.entryIds,
          (id) => id,
          ({ item }) => () => settings.renderEntry(item()),
          {
            empty: () => html`
              <RodSettingsRow>
                <RodSettingsText>No settings registered.</RodSettingsText>
              </RodSettingsRow>
            `,
          },
        )}
      </RodSettingsSection>
    </RodSharedScrollableBody>
  `;
});
