import { describe, expect, it } from "vitest";
import {
  createBuildMetadata,
  createIifeBuildBanner,
} from "./build-metadata";

describe("build metadata", () => {
  it("formats build timestamps in GMT-3 and preserves the full commit SHA", () => {
    const metadata = createBuildMetadata({
      root: process.cwd(),
      version: "1.2.3",
      mode: "production",
      now: new Date("2026-07-18T12:34:00.000Z"),
      sha: "0123456789abcdef0123456789abcdef01234567",
    });

    expect(metadata).toMatchObject({
      sha: "0123456789abcdef0123456789abcdef01234567",
      shortSha: "0123456",
      builtAt: "2026-07-18T12:34:00.000Z",
      builtAtGmtMinus3: "18/07/26 09:34 GMT-3",
      buildDateShort: "18/07/26",
      buildTimeShort: "09:34",
      timezone: "GMT-3",
      mode: "production",
      version: "1.2.3",
    });
  });

  it("writes GMT-3 build time and commit SHA into IIFE banners", () => {
    const metadata = createBuildMetadata({
      root: process.cwd(),
      now: new Date("2026-07-18T12:34:00.000Z"),
      sha: "abcdef1234567890",
    });

    const banner = createIifeBuildBanner(metadata, {
      tool: "RodEruda",
      globalName: "DevTools",
      entry: "devtools/index.ts",
      generatedBy: "test build",
    });

    expect(banner).toContain("Built: 18/07/26 09:34 GMT-3");
    expect(banner).toContain("Commit: abcdef1234567890");
    expect(banner).toContain("@global DevTools");
    expect(banner).toContain("@entry devtools/index.ts");
  });
});
