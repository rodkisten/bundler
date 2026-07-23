import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DEVTOOLS_STYLE_FILES = [
  "devtools/shell.ts",
  "devtools/panels-shared-components.ts",
  "devtools/console-components.ts",
  "devtools/network-components.ts",
  "devtools/resources-components.ts",
  "devtools/settings-components.ts",
  "devtools/sources-components.ts",
  "devtools/elements-components.ts",
] as const;

function readDevtoolsStyleSources(): string {
  return DEVTOOLS_STYLE_FILES
    .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
    .join("\n");
}

describe("DevTools Cipó authoring surface", () => {
  it("keeps legacy and modern Cipó syntax in production components", () => {
    const source = readDevtoolsStyleSources();

    // Legacy compatibility syntax stays intentionally exercised.
    expect(source).toContain("@with($control-reset)");
    expect(source).toContain("$interactive-surface");
    expect(source).toContain("$theme.colors.foreground");

    // Modern aliases, local properties and deep helpers are used by real UI.
    expect(source).toContain("interactive-surface");
    expect(source).toContain("$$shellReveal");
    expect(source).toContain("text(");
    expect(source).toContain("fluid(");
    expect(source).toContain("motion(");

    // Fábrica-native state and relational selectors stay on one vocabulary.
    expect(source).toContain("state(");
    expect(source).toContain("group(");
    expect(source).toContain("variant(");
    expect(source).toContain("compound(");
    expect(source).toContain("slot(");
    expect(source).toContain("&:jsExecution='false'");
    expect(source).toContain("&:status^='2'");

    // Responsive and container-aware authoring covers both generations.
    expect(source).toContain("x:md");
    expect(source).toContain("x:cq(");
    expect(source).toContain("x:container(");
    expect(source).toMatch(/width:\s*\{\s*base:/s);

    // Enterprise priority syntax remains covered by a real console state.
    expect(source).toContain("!display: none");
  });
});
