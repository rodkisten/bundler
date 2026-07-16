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
    expect(built).toContain('<script defer src="./devtools.landing.js"></script>');
    expect(built).not.toContain("/landing.ts");
  });

  it("resolves canonical DevTools core and panel aliases to flat source files first", () => {
    expect(workspaceSourceCandidates("devtools", "core/shell")[0]).toBe(
      path.join(process.cwd(), "devtools/core-shell.ts"),
    );
    expect(workspaceSourceCandidates("devtools", "panels/elements")[0]).toBe(
      path.join(process.cwd(), "devtools/panels-elements.ts"),
    );
  });

});
