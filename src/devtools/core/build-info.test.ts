import { describe, expect, it } from "vitest";
import { DEVTOOLS_BUILD_BADGE, DEVTOOLS_BUILD_INFO } from "./build-info";

describe("DevTools build metadata", () => {
  it("always exposes a compact badge and stable timezone contract", () => {
    expect(DEVTOOLS_BUILD_INFO.timezone).toBe("GMT-3");
    expect(DEVTOOLS_BUILD_INFO.shortSha.length).toBeGreaterThan(0);
    expect(DEVTOOLS_BUILD_BADGE).toContain(DEVTOOLS_BUILD_INFO.shortSha);
  });
});
