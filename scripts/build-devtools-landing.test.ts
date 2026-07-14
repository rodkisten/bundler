import { describe, expect, it } from "vitest";
import { createBuiltDevtoolsLandingHtml } from "./build-devtools-landing";

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
});
