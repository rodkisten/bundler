/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { createFabricaApi } from "@rodkisten/fabrica";

const TEST_ALIASES = [
  "$fabricaInstallTest",
  "$fabricaInstallNested",
  "$fabricaInstallExternal",
] as const;

type MutableGlobals = typeof globalThis &
  Record<string, unknown>;

const globals = globalThis as MutableGlobals;
const snapshots = new Map<
  string,
  { existed: boolean; value: unknown }
>();
const fabricaSnapshot = {
  existed: "Fabrica" in globals,
  value: globals.Fabrica,
};

for (const alias of TEST_ALIASES) {
  snapshots.set(alias, {
    existed: alias in globals,
    value: globals[alias],
  });
}

afterEach(() => {
  if (fabricaSnapshot.existed) {
    globals.Fabrica = fabricaSnapshot.value;
  } else {
    delete globals.Fabrica;
  }

  for (const alias of TEST_ALIASES) {
    const snapshot = snapshots.get(alias)!;
    if (snapshot.existed) globals[alias] = snapshot.value;
    else delete globals[alias];
  }
});

describe("Fabrica global installation lifecycle", () => {
  it("restores custom aliases captured at installation time", () => {
    const alias = TEST_ALIASES[0];
    const previous = { owner: "before-fabrica" };
    globals[alias] = previous;

    const api = createFabricaApi();
    api.install({
      exposeDollarEl: true,
      dollarAlias: alias,
      forceAlias: true,
    });

    expect(globals[alias]).toBe(api.$);

    api.noConflict();

    expect(globals[alias]).toBe(previous);
  });

  it("unwinds nested installations in last-in-first-out order", () => {
    const alias = TEST_ALIASES[1];
    const previousFabrica = globals.Fabrica;
    const api = createFabricaApi();

    api.install({
      exposeDollarEl: true,
      dollarAlias: alias,
      forceAlias: true,
    });
    api.install({
      exposeDollarEl: true,
      dollarAlias: alias,
      forceAlias: true,
    });

    api.noConflict();
    expect(globals.Fabrica).toBe(api);
    expect(globals[alias]).toBe(api.$);

    api.noConflict();
    expect(globals.Fabrica).toBe(previousFabrica);
  });

  it("does not overwrite globals taken over after installation", () => {
    const alias = TEST_ALIASES[2];
    const externalOwner = { owner: "external-library" };
    const api = createFabricaApi();

    api.install({
      exposeDollarEl: true,
      dollarAlias: alias,
      forceAlias: true,
    });
    globals[alias] = externalOwner;
    Reflect.set(globals, "Fabrica", externalOwner);

    api.noConflict();

    expect(globals[alias]).toBe(externalOwner);
    expect(globals.Fabrica).toBe(externalOwner);
  });

  it("resets runtime install options between installations", () => {
    const api = createFabricaApi();

    api.install({ exposeDollar: true });
    expect(api.config.exposeDollar).toBe(true);
    api.noConflict();

    api.install();
    expect(api.config.exposeDollar).toBe(false);
    api.noConflict();
  });
});
