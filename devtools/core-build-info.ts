export interface DevtoolsBuildInfo {
  readonly sha: string;
  readonly shortSha: string;
  readonly builtAt: string;
  readonly builtAtGmtMinus3: string;
  readonly buildDateShort: string;
  readonly buildTimeShort: string;
  readonly timezone: "GMT-3";
  readonly mode: string;
  readonly version: string;
}

declare const __RODERUDA_BUILD__: DevtoolsBuildInfo | undefined;

const FALLBACK_BUILD_INFO: DevtoolsBuildInfo = Object.freeze({
  sha: "dev",
  shortSha: "dev",
  builtAt: new Date(0).toISOString(),
  builtAtGmtMinus3: "dev build",
  buildDateShort: "dev",
  buildTimeShort: "local",
  timezone: "GMT-3",
  mode: "dev",
  version: "0.0.0-dev",
});

export const DEVTOOLS_BUILD_INFO: DevtoolsBuildInfo = Object.freeze(
  typeof __RODERUDA_BUILD__ !== "undefined" && __RODERUDA_BUILD__
    ? __RODERUDA_BUILD__
    : FALLBACK_BUILD_INFO,
);

export const DEVTOOLS_BUILD_BADGE = `${DEVTOOLS_BUILD_INFO.shortSha} <br> ${DEVTOOLS_BUILD_INFO.buildDateShort} ${DEVTOOLS_BUILD_INFO.buildTimeShort}`;
