import { describe, expect, it } from "vitest";
import { extractNascenteApi } from "./build-nascente-docs";

describe("Nascente docs generator", () => {
  it("extracts exported declarations and their TSDoc sections", () => {
    const api = extractNascenteApi(`
      /** Maps values.\n       * @remarks Replaces Object.entries().map().\n       * @example mapValues(input, String)\n       */
      export function mapValues<T>(value: T): T { return value; }
    `);

    expect(api).toHaveLength(1);
    expect(api[0]).toMatchObject({
      name: "mapValues",
      kind: "function",
      category: "object",
    });
    expect(api[0]?.remarks).toContain("Object.entries");
    expect(api[0]?.example).toContain("mapValues");
  });

  it("keeps undocumented exports visible instead of silently dropping API surface", () => {
    const api = extractNascenteApi(`export const noop = () => {};`);
    expect(api.map((item) => item.name)).toEqual(["noop"]);
  });
});

// The public barrel is intentionally declaration-free; docs are extracted from category modules.
describe("Nascente category modules", () => {
  it("extracts declarations when multiple category module sources are concatenated", () => {
    const api = extractNascenteApi(`
      export function chunk<T>(array: readonly T[]): T[][] { return [array.slice()]; }
      export type Awaitable<T> = T | PromiseLike<T>;
      export class TimeoutError extends Error {}
    `);

    expect(api.map((item) => item.name)).toEqual(["chunk", "TimeoutError", "Awaitable"]);
  });
});
