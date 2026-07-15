import {
  createOwner,
  createRequiredContext,
  disposeOwner,
  provide,
  runWithOwner,
  signal,
  type Cleanup,
  type Owner,
  type Signal,
} from "@rodkisten/broto";
import type {
  DevtoolsControllerLike,
  SettingsLike,
  ToolContext,
} from "@rodkisten/devtools/types";
import type { ShellRefs } from "@rodkisten/devtools/core-shell";

/** Shared DevTools environment available to every Fabrica component root. */
export interface DevtoolsContextValue {
  readonly inline: boolean;
  readonly host: HTMLElement;
  readonly controller: Signal<DevtoolsControllerLike | null>;
  readonly refs: Signal<ShellRefs | null>;
  readonly settings: Signal<SettingsLike | null>;
  readonly toolContext: Signal<ToolContext | null>;
  readonly activePanel: Signal<string>;
  readonly visible: Signal<boolean>;
}

export const DevtoolsContext = createRequiredContext<DevtoolsContextValue>(
  "RodDevtoolsContext",
);

export interface DevtoolsContextScope {
  readonly value: DevtoolsContextValue;
  readonly owner: Owner;
  run<Value>(callback: () => Value): Value;
  dispose: Cleanup;
}

/** Creates the single owner scope shared by shell, controller and panel roots. */
export function createDevtoolsContextScope(
  host: HTMLElement,
  inline: boolean,
): DevtoolsContextScope {
  const owner = createOwner({
    name: "RodDevtoolsContext",
    parent: null,
  });

  const value: DevtoolsContextValue = Object.freeze({
    inline,
    host,
    controller: signal<DevtoolsControllerLike | null>(null, { name: "devtools.controller" }),
    refs: signal<ShellRefs | null>(null, { name: "devtools.refs" }),
    settings: signal<SettingsLike | null>(null, { name: "devtools.settings" }),
    toolContext: signal<ToolContext | null>(null, { name: "devtools.toolContext" }),
    activePanel: signal("", { name: "devtools.activePanel" }),
    visible: signal(inline, { name: "devtools.visible" }),
  });

  runWithOwner(owner, () => provide(DevtoolsContext, value));

  return {
    value,
    owner,
    run(callback) {
      return runWithOwner(owner, callback);
    },
    dispose() {
      disposeOwner(owner);
    },
  };
}
