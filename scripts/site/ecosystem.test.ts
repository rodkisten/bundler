import { describe, expect, it } from "vitest";
import { BUNDLER_BASE_PATH, ECOSYSTEM_PROJECTS, SOCIAL_LINKS } from "./ecosystem";

describe("ecosystem registry", () => {
  it("keeps every public project on one unique /bundler URL graph", () => {
    const paths = ECOSYSTEM_PROJECTS.map((project) => project.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.startsWith(BUNDLER_BASE_PATH))).toBe(true);
  });

  it("publishes the requested Rod Kisten social destinations", () => {
    expect(SOCIAL_LINKS.map((link) => link.label)).toEqual([
      "GitHub",
      "Instagram",
      "X / Twitter",
      "Website",
    ]);
  });
});
