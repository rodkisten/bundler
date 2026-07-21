import { $ } from "./bag.js";
import {
  config,
  configureRuntime,
} from "./install-state.js";
import type { InstallOptions } from "./types.js";
import { notifyFabricaRegistryReady } from
  "@rodkisten/fabrica-elements/registry";
import type { ElementsComponentRegistry } from
  "@rodkisten/fabrica-elements";

type GlobalRecord = Record<string, unknown>;

type PreviousGlobal = {
  readonly existed: boolean;
  readonly value: unknown;
};

type InstallationRecord = {
  readonly previousFabrica: PreviousGlobal;
  readonly aliases: Map<string, PreviousGlobal>;
};

const installations = new WeakMap<object, InstallationRecord[]>();

/**
 * Installs a Fábrica instance on `globalThis` and records exactly what changed.
 *
 * Previous globals are captured at installation time, not module evaluation
 * time. `noConflict()` can therefore restore custom aliases and `Fabrica`
 * without overwriting values that another library changed after installation.
 */
export function install<Api extends ElementsComponentRegistry>(
  api: Api,
  options: InstallOptions = {},
): Api {
  configureRuntime(options);

  const globals = globalThis as unknown as GlobalRecord;
  const record: InstallationRecord = {
    previousFabrica: readPreviousGlobal(globals, "Fabrica"),
    aliases: new Map<string, PreviousGlobal>(),
  };

  globals.Fabrica = api;
  notifyFabricaRegistryReady(api);

  if (config.exposeDollar) {
    installAlias(globals, "$", record);
  }

  if (config.exposeDollarEl) {
    installAlias(globals, config.dollarAlias || "$el", record);
  }

  const stack = installations.get(api) ?? [];
  stack.push(record);
  installations.set(api, stack);
  return api;
}

/** Restores globals changed by the most recent installation of this instance. */
export function noConflict<Api extends ElementsComponentRegistry>(
  api: Api,
): Api {
  const globals = globalThis as unknown as GlobalRecord;
  const stack = installations.get(api);
  const record = stack?.pop();
  if (!record) return api;

  for (const [alias, previous] of record.aliases) {
    if (globals[alias] === $) restoreGlobal(globals, alias, previous);
  }

  if (globals.Fabrica === api) {
    restoreGlobal(globals, "Fabrica", record.previousFabrica);
  }

  if (stack?.length === 0) installations.delete(api);
  return api;
}

function installAlias(
  globals: GlobalRecord,
  alias: string,
  record: InstallationRecord,
): void {
  if (!config.forceAlias && alias in globals) return;
  record.aliases.set(alias, readPreviousGlobal(globals, alias));
  globals[alias] = $;
}

function readPreviousGlobal(
  globals: GlobalRecord,
  name: string,
): PreviousGlobal {
  return {
    existed: name in globals,
    value: globals[name],
  };
}

function restoreGlobal(
  globals: GlobalRecord,
  name: string,
  previous: PreviousGlobal,
): void {
  if (previous.existed) globals[name] = previous.value;
  else delete globals[name];
}
