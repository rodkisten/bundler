import { describe, expect, it } from "vitest";
import {
  createVisualLines,
  getLineNumberGutterWidth,
} from "@rodkisten/maquina/visual";

describe("Maquina visual lines", () => {
  it("preserves token kinds across multiline tokens", () => {
    const lines = createVisualLines([
      {
        value: "/* first\nsecond */",
        kind: "comment",
      },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0]?.tokens[0]).toEqual({
      value: "/* first",
      kind: "comment",
    });
    expect(lines[1]?.tokens[0]).toEqual({
      value: "second */",
      kind: "comment",
    });
  });

  it("keeps line numbers stable for virtualized ranges", () => {
    const lines = createVisualLines(
      [{ value: "a\nb", kind: "plain" }],
      249,
    );

    expect(lines.map((line) => line.number)).toEqual([250, 251]);
  });

  it("removes gutter width only when line numbers are disabled", () => {
    expect(getLineNumberGutterWidth(100, false)).toBe("0px");
    expect(getLineNumberGutterWidth(100, true)).toContain("3ch");
  });
});
