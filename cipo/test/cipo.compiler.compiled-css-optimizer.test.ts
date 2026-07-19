import { describe, expect, it } from "vitest";
import { optimizeCompiledCss } from "@rodkisten/cipo/compiler";

describe("compiled CSS optimizer grouping at-rules", () => {
  it("groups adjacent equivalent media queries", () => {
    const css = `
      @media (min-width: 768px) { .a { display: flex; } }
      @media (min-width: 768px) { .b { color: red; } }
      @media (min-width: 768px) { .c { padding: 1rem; } }
    `;

    expect(optimizeCompiledCss(css)).toBe(
      "@media (min-width:768px){.a{display:flex}.b{color:red}.c{padding:1rem}}",
    );
  });

  it("does not move media queries across cascade boundaries", () => {
    const css = `
      @media (min-width: 768px) { .a { color: red; } }
      .a { color: blue; }
      @media (min-width: 768px) { .a { color: green; } }
    `;

    expect(optimizeCompiledCss(css)).toBe(
      "@media (min-width:768px){.a{color:red}}.a{color:blue}@media (min-width:768px){.a{color:green}}",
    );
  });

  it("groups supports and container blocks with the same prelude", () => {
    const css = `
      @supports (display: grid) { .a { display: grid; } }
      @supports (display: grid) { .b { display: grid; } }
      @container card (min-width: 40rem) { .c { display: flex; } }
      @container card (min-width: 40rem) { .d { display: grid; } }
    `;

    expect(optimizeCompiledCss(css)).toBe(
      "@supports (display:grid){.a{display:grid}.b{display:grid}}@container card (min-width:40rem){.c{display:flex}.d{display:grid}}",
    );
  });

  it("groups media queries recursively inside rule-list wrappers", () => {
    const css = `
      @layer components {
        @media (min-width: 768px) { .a { display: flex; } }
        @media (min-width: 768px) { .b { display: grid; } }
      }
    `;

    expect(optimizeCompiledCss(css)).toBe(
      "@layer components{@media (min-width:768px){.a{display:flex}.b{display:grid}}}",
    );
  });


  it("keeps case-sensitive container names separate", () => {
    const css =
      "@container Foo (min-width:1px){.a{color:red}}" +
      "@container foo (min-width:1px){.b{color:blue}}";

    expect(optimizeCompiledCss(css)).toBe(css);
  });

  it("preserves readable unminified CSS unless at-rule merging is requested", () => {
    const css = `/* keep */
@media (min-width: 768px) { .a { display: flex; } }
@media (min-width: 768px) { .b { display: grid; } }`;

    expect(optimizeCompiledCss(css, {
      minify: false,
      mergeEquivalentAtRules: false,
      mergeEquivalentRules: false,
    })).toBe(css);
  });

  it("can keep equivalent at-rules separate when explicitly disabled", () => {
    const css =
      "@media (min-width:768px){.a{display:flex}}" +
      "@media (min-width:768px){.b{display:grid}}";

    expect(
      optimizeCompiledCss(css, { mergeEquivalentAtRules: false }),
    ).toBe(css);
  });
});
