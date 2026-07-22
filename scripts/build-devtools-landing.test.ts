import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createBuiltDevtoolsLandingHtml } from "./build-devtools-landing";
import { workspaceSourceCandidates } from "./config";

describe("DevTools landing build", () => {
  it("creates relocatable static asset references", () => {
    const source = `<!doctype html>
<html>
<head>
  <base href="https://rod.migos.club/bundler">
  <link rel="stylesheet" href="/landing.css" />
</head>
<body>
  <script type="module" src="/landing.ts"></script>
</body>
</html>`;

    const built = createBuiltDevtoolsLandingHtml(source);

    expect(built).not.toContain("<base");
    expect(built).toContain('href="./landing.css"');
    expect(built).toContain('<script type="module" src="./landing.ts"></script>');
    expect(built).not.toContain("/landing.ts");
  });

  it("resolves canonical DevTools aliases to current flat modules before legacy prefixed fallbacks", () => {
    expect(workspaceSourceCandidates("devtools", "core/shell").find(existsSync)).toBe(
      path.join(process.cwd(), "devtools/shell.ts"),
    );
    expect(workspaceSourceCandidates("devtools", "panels/elements").find(existsSync)).toBe(
      path.join(process.cwd(), "devtools/elements.ts"),
    );

    // Internal modules that only exist under the legacy prefix still resolve without
    // forcing callers to change the canonical `core/*` / `panels/*` import surface.
    expect(workspaceSourceCandidates("devtools", "core/dom").find(existsSync)).toBe(
      path.join(process.cwd(), "devtools/core-dom.ts"),
    );
    expect(workspaceSourceCandidates("devtools", "panels/shared-components").find(existsSync)).toBe(
      path.join(process.cwd(), "devtools/panels-shared-components.ts"),
    );
  });

});
