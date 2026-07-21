import { compileFabricaSource } from "@rodkisten/fabrica/compiler";
import { describe, expect, it } from "vitest";

describe("Fábrica AST compiler", () => {
  it("preserves directive prologues before generated imports", () => {
    const result = compileFabricaSource(
      '"use client";\nconst view = html`<button>Save</button>`;',
    );

    expect(result.changed).toBe(true);
    expect(result.code.startsWith('"use client";')).toBe(true);
    expect(result.code.indexOf("import {")).toBeGreaterThan(
      result.code.indexOf('"use client";'),
    );
  });

  it("preserves a shebang as the first source line", () => {
    const result = compileFabricaSource(
      '#!/usr/bin/env node\nconst view = html`<main>CLI</main>`;',
      { filename: "cli.ts" },
    );

    expect(result.changed).toBe(true);
    expect(result.code.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  it("uses a collision-free helper binding", () => {
    const result = compileFabricaSource([
      "const createCompiledTemplate = 1;",
      "const view = html`<main>Safe</main>`;",
    ].join("\n"));

    expect(result.code).toContain(
      "createCompiledTemplate as __fabricaCreateCompiledTemplate",
    );
    expect(result.code).toContain(
      "__fabricaCreateCompiledTemplate(html,",
    );
  });

  it("does not transform a definitely unrelated local html binding", () => {
    const source = [
      "const html = String.raw;",
      "const value = html`not fabrica`;",
    ].join("\n");
    const result = compileFabricaSource(source);

    expect(result.changed).toBe(false);
    expect(result.code).toBe(source);
  });

  it("keeps isolated Vite AST nodes bound to their own checker", () => {
    const source = [
      'import { html } from "@rodkisten/devtools/core/runtime";',
      "export const view = html`<main>DevTools</main>`;",
    ].join("\n");

    expect(() => compileFabricaSource(source, {
      filename: "/project/devtools/controller.ts",
    })).not.toThrow();
  });

  it("respects lexical shadowing of aliased html imports", () => {
    const source = [
      'import { html as h } from "@rodkisten/fabrica";',
      "function render(h: typeof String.raw) {",
      "  return h`not fabrica`;",
      "}",
    ].join("\n");
    const result = compileFabricaSource(source);

    expect(result.changed).toBe(false);
    expect(result.code).toBe(source);
  });

  it("respects lexical shadowing of configured html tags", () => {
    const source = [
      'import { html } from "@rodkisten/fabrica";',
      "function render(html: typeof String.raw) {",
      "  return html`not fabrica`;",
      "}",
    ].join("\n");
    const result = compileFabricaSource(source);

    expect(result.changed).toBe(false);
    expect(result.code).toBe(source);
  });

  it("resolves aliased Fábrica html imports", () => {
    const result = compileFabricaSource([
      'import { html as h } from "@rodkisten/fabrica";',
      "const view = h`<main>Alias</main>`;",
    ].join("\n"));

    expect(result.changed).toBe(true);
    expect(result.code).not.toContain("h`<main>");
    expect(result.code).toContain("createCompiledTemplate(h,");
  });

  it("compiles nested Fábrica templates inside ordinary template literals", () => {
    const result = compileFabricaSource([
      "const text = `prefix ${html`<strong>${value}</strong>`} suffix`;",
    ].join("\n"));

    expect(result.changed).toBe(true);
    expect(result.code).not.toContain("html`<strong>");
    expect(result.manifest).toHaveLength(1);
  });

  it("handles regex literals and comments inside interpolation expressions", () => {
    const result = compileFabricaSource([
      "const view = html`<p>${/}/.test(value)",
      "  // a brace in a comment: }",
      "  ? html`<strong>yes</strong>`",
      "  : html`<em>no</em>`}</p>`;",
    ].join("\n"));

    expect(result.changed).toBe(true);
    expect(result.code).not.toMatch(/\bhtml`/);
    expect(result.manifest).toHaveLength(3);
  });

  it("parses greater-than signs inside quoted attributes", () => {
    const result = compileFabricaSource(
      'const view = html`<div title="a > b">Value</div>`;',
    );

    expect(result.changed).toBe(true);
    expect(result.manifest[0]?.fallback).toBe(false);
    expect(result.code).toContain('"a > b"');
  });

  it("emits direct component refs only for visible value bindings", () => {
    const result = compileFabricaSource([
      "const Known = () => null;",
      "const view = html`<Known /><Unknown />`;",
    ].join("\n"), {
      directComponentReferences: true,
    });

    expect(result.changed).toBe(true);
    expect(result.code).toMatch(/\[0,Known,/);
    expect(result.code).toMatch(/\[0,"Unknown",/);
  });
});
