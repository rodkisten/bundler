import { describe, expect, it } from "vitest";
import { compileFabricaSource } from "@rodkisten/fabrica/compiler";

describe("Fábrica recursive compiled templates", () => {
  it("compiles nested html templates inside interpolation expressions to a fixed compiled tree", () => {
    const source = [
      "const view = html`",
      "  <RodElementsStylesView>",
      "    ${props.rules.map((rule) => html`",
      "      <RodElementsStyleRule>",
      "        ${rule.source ? html`<RodElementsStyleSource>${rule.source}</RodElementsStyleSource>` : \"\"}",
      "      </RodElementsStyleRule>",
      "    `)}",
      "  </RodElementsStylesView>",
      "`;",
    ].join("\n");

    const result = compileFabricaSource(source, {
      filename: "elements.components.ts",
      importPath: "../compiler-runtime",
      directComponentReferences: true,
    });

    expect(result.changed).toBe(true);
    expect(result.code).not.toMatch(/\bhtml`/);
    expect(result.code).not.toContain("<RodElementsStyleRule>");
    expect(result.code).toContain("RodElementsStylesView");
    expect(result.code).toContain("RodElementsStyleRule");
    expect(result.code).toContain("RodElementsStyleSource");
    expect(result.code.match(/createCompiledTemplate\(html,\s*\[/g)).toHaveLength(3);

    // Each manifest entry counts only its own top-level slots. Nested `${}`
    // expressions belong to their nested template instead of inflating the parent.
    expect(result.manifest).toHaveLength(3);
    expect(result.manifest.map((entry) => entry.dynamicValues)).toEqual([1, 1, 1]);
    expect(result.manifest[0]?.start).toBeLessThan(result.manifest[1]?.start ?? 0);
  });

  it("ignores html-like tagged templates inside comments, TSDoc, and string literals", () => {
    const source = [
      "/** JSX-friendly namespace for `html`` authoring. */",
      "// const fake = html`<div>comment</div>`;",
      "const docs = \"html`<div>string</div>`\";",
      "const unrelated = `html` + \"not a tag\";",
      "const view = html`<section>${value}</section>`;",
    ].join("\n");

    const result = compileFabricaSource(source, {
      filename: "dom.ts",
      importPath: "../compiler-runtime",
      directComponentReferences: true,
    });

    expect(result.changed).toBe(true);
    expect(result.code).toContain("/** JSX-friendly namespace for `html`` authoring. */");
    expect(result.code).toContain("// const fake = html`<div>comment</div>`;");
    expect(result.code).toContain('const docs = \"html`<div>string</div>`\";');
    expect(result.code).toContain("createCompiledTemplate");
    expect(result.manifest).toHaveLength(1);
  });

  it("drops multiline indentation-only text from compact runtime instructions", () => {
    const source = [
      "const view = html`<RodRoot>",
      "  <RodChild>Label</RodChild>",
      "  ${value}",
      "</RodRoot>`;",
    ].join("\n");

    const result = compileFabricaSource(source, {
      directComponentReferences: true,
    });

    expect(result.changed).toBe(true);
    expect(result.code).not.toContain('[1,"\\n  "]');
    expect(result.code).not.toContain('[1,"\\n"]');
    expect(result.code).toContain("RodRoot");
    expect(result.code).toContain("RodChild");
  });

  it("preserves deliberate inline spaces between sibling elements", () => {
    const result = compileFabricaSource(
      "const view = html`<RodRoot><span>Hello</span> <span>world</span></RodRoot>`;",
      { directComponentReferences: true },
    );

    expect(result.changed).toBe(true);
    expect(result.code).toContain('[1," "]');
  });

  it("preserves multiline whitespace inside pre and textarea elements", () => {
    const result = compileFabricaSource(
      [
        "const view = html`<RodRoot><pre>",
        "  ${value}",
        "</pre><textarea>",
        "  ${text}",
        "</textarea></RodRoot>`;",
      ].join("\n"),
      { directComponentReferences: true },
    );

    expect(result.changed).toBe(true);
    expect(result.code).toContain('[1,"\\n  "]');
    expect(result.code).toContain('[1,"\\n"]');
  });
});
