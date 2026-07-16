import { signal } from "@rodkisten/broto";
import { createRequiredFabricaContext, type RenderValue } from "@rodkisten/fabrica";
import type {
  DevtoolsContextValue,
  DevtoolsControllerLike,
  DevtoolsNotificationEntry,
  DevtoolsShellRefs,
  DevtoolsToolRegistration,
  SettingsLike,
  ToolContext,
} from "@rodkisten/devtools/types";

/** Shared application context inherited by every component below the DevTools root. */
export const DevtoolsContext = createRequiredFabricaContext<DevtoolsContextValue>(
  "RodDevtoolsContext",
);

/** Creates the stable signal graph owned by the single DevTools Fábrica root. */
export function createDevtoolsContextValue(
  host: HTMLElement,
  inline: boolean,
): DevtoolsContextValue {
  return Object.freeze({
    inline,
    host,
    controller: signal<DevtoolsControllerLike | null>(null, { name: "devtools.controller" }),
    refs: signal<DevtoolsShellRefs | null>(null, { name: "devtools.refs" }),
    settings: signal<SettingsLike | null>(null, { name: "devtools.settings" }),
    toolContext: signal<ToolContext | null>(null, { name: "devtools.toolContext" }),
    tools: signal<readonly DevtoolsToolRegistration[]>([], { name: "devtools.tools" }),
    activePanel: signal("", { name: "devtools.activePanel" }),
    visible: signal(inline, { name: "devtools.visible" }),
    notifications: signal<readonly DevtoolsNotificationEntry[]>([], { name: "devtools.notifications" }),
    modal: signal<RenderValue | null>(null, { name: "devtools.modal" }),
  });
}

export type { DevtoolsContextValue, DevtoolsNotificationEntry, DevtoolsToolRegistration } from "@rodkisten/devtools/types";
