import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Máquina landing page", () => {
  it("loads one environment-appropriate runtime and mounts through its public API", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

    expect(html).toContain('return await import("./index.ts")');
    expect(html).toContain('new URL("../maquina.iife.js", location.href)');
    expect(html).toContain("globalThis.Maquina?.mountMaquina");
    expect(html).toContain("bootLanding().catch");

    expect(html).not.toContain("https://rod.migos.club/bundler/maquina.iife.js");
    expect(html).not.toContain("const { mountMaquina } = Maquina");
  });
});
