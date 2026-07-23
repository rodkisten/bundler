import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { maquinaCipoConfigCss } from "@rodkisten/maquina/cipo-config";

function readMaquinaSource(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}

describe("Maquina Cipó authoring surface", () => {
  it("keeps one CSS-first contract for runtime and compiled builds", () => {
    expect(maquinaCipoConfigCss).toContain("@cipo");
    expect(maquinaCipoConfigCss).toContain("@breakpoints");
    expect(maquinaCipoConfigCss).toContain("@alias editor-reset");
    expect(maquinaCipoConfigCss).toContain("@helper touch-scroll");
    expect(maquinaCipoConfigCss).toContain("@property $$gutterWidth");
    expect(maquinaCipoConfigCss).toContain("@property $$scrollX");

    const components = readMaquinaSource("maquina/components.ts");
    const viteProjects = readMaquinaSource("scripts/vite/project-configs.ts");

    expect(components).toContain("configureFromCss(maquinaCipoConfigCss)");
    expect(viteProjects).toContain(
      'configRuntimeBindings: ["maquinaCipoConfigCss"]',
    );
  });

  it("uses legacy and modern Cipó syntax in the editor components", () => {
    const source = readMaquinaSource("maquina/components.ts");

    expect(source).toContain("@with($editor-reset)");
    expect(source).toContain("touch-scroll");
    expect(source).toContain("$$gutterWidth<length>");
    expect(source).toContain("$$fontSize<length>");
    expect(source).toContain("calc($$gutterWidth + 16px)");
    expect(source).toContain("text($$fontSize / 1.55 / 500)");
    expect(source).toContain("fluid(");
    expect(source).toContain("peer(editor, open=true)");
    expect(source).toContain("state(active=true)");
    expect(source).toContain("slot(label)");
    expect(source).toContain("slot(detail)");
    expect(source).toContain("& :token='comment'");
  });
});
