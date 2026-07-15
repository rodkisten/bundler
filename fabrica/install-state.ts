import type { RuntimeConfig } from "@rodkisten/fabrica/types";

/** Mutable runtime config used by the bag and install layers. */
export const config: RuntimeConfig = {
  exposeDollar: false,
  exposeDollarEl: true,
  dollarAlias: "$el",
  forceAlias: false,
  createWhenSelectorMisses: true,
};
