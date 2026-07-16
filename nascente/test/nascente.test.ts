import { describe, expect, it } from "vitest";
import {
  Mutex,
  TimeoutError,
  atIterable,
  camelCase,
  chunk,
  cloneDeep,
  compactMapArray,
  concatArrays,
  difference,
  drainArray,
  filterArray,
  filterJoinArray,
  filterTakeIterable,
  forEachObject,
  groupBy,
  includesIgnoreCase,
  mapArray,
  mapAsync,
  mapFilterArray,
  mapJoinArray,
  mapJoinIterable,
  mapObject,
  mapValues,
  merge,
  moveArrayItem,
  objectToMap,
  removeAtArray,
  splitAsciiWhitespace,
  splitLines,
  splitNonEmpty,
  splitOnce,
  splitTrimmedNonEmpty,
  sumBy,
  trimArrayStart,
  uniq,
  withTimeout,
} from "@rodkisten/nascente";

describe("nascente", () => {
  it("handles hot array transforms", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(uniq([1, 1, 2])).toEqual([1, 2]);
    expect(difference([1, 2, 3], [2])).toEqual([1, 3]);
  });

  it("maps ArrayLike values into preallocated output", () => {
    const arrayLike = { 0: 2, 1: 4, length: 2 } as const;
    expect(mapArray(arrayLike, (value) => value * 2)).toEqual([4, 8]);
  });

  it("filters and fuses array transforms without intermediate pipelines", () => {
    expect(filterArray([1, 2, 3, 4], (value) => value % 2 === 0)).toEqual([2, 4]);
    expect(compactMapArray([1, 2, 3], (value) => value % 2 ? value * 10 : undefined)).toEqual([10, 30]);
    expect(mapFilterArray([1, 2, 3], (value) => value * 2, (value) => value > 2)).toEqual([4, 6]);
    expect(filterJoinArray(["a", "", "b"], Boolean, ";")).toBe("a;b");
  });

  it("maps and joins arrays and iterables in one traversal", () => {
    expect(mapJoinArray([1, 2, 3], (value) => `#${value}`, ",")).toBe("#1,#2,#3");
    expect(mapJoinIterable(new Set([1, 2]), (value) => `v${value}`, "|")).toBe("v1|v2");
  });

  it("consumes iterables lazily when only a bounded result is required", () => {
    const values = new Set([1, 2, 3, 4, 5]);
    expect(filterTakeIterable(values, (value) => value % 2 === 0, 1)).toEqual([2]);
    expect(atIterable(values, 2)).toBe(3);
  });

  it("concatenates heterogeneous arrays without spread", () => {
    expect(concatArrays([1, 2], ["river"], [true])).toEqual([1, 2, "river", true]);
  });

  it("mutates queues and registries without splice", () => {
    const removable = ["a", "b", "c"];
    expect(removeAtArray(removable, 1)).toBe("b");
    expect(removable).toEqual(["a", "c"]);

    const movable = ["a", "b", "c"];
    expect(moveArrayItem(movable, 2, 0)).toEqual(["c", "a", "b"]);

    const bounded = [1, 2, 3, 4];
    expect(trimArrayStart(bounded, 2)).toEqual([3, 4]);
    expect(drainArray(bounded)).toEqual([3, 4]);
    expect(bounded).toEqual([]);
  });

  it("groups without prototype pollution", () => {
    const grouped = groupBy(["a", "bb", "c"], (value) => value.length);
    expect(grouped[1]).toEqual(["a", "c"]);
  });

  it("transforms objects without Object.entries tuples", () => {
    expect(mapValues({ a: 1, b: 2 }, (value) => value * 2)).toEqual({ a: 2, b: 4 });
    expect(mapObject({ a: 1, b: 2 }, (value, key) => `${key}:${value}`)).toEqual(["a:1", "b:2"]);

    const visited: string[] = [];
    forEachObject({ a: 1, b: 2 }, (value, key) => visited.push(`${key}:${value}`));
    expect(visited).toEqual(["a:1", "b:2"]);
    expect(objectToMap({ a: 1, b: 2 })).toEqual(new Map([["a", 1], ["b", 2]]));
  });

  it("uses allocation-conscious string helpers", () => {
    expect(includesIgnoreCase("Safari WebKit", "webkit")).toBe(true);
    expect(splitAsciiWhitespace("  one\ttwo\nthree  ")).toEqual(["one", "two", "three"]);
    expect(splitOnce("name=value=rest", "=")).toEqual(["name", "value=rest"]);
    expect(splitNonEmpty("a,,b", ",")).toEqual(["a", "b"]);
    expect(splitTrimmedNonEmpty(" a, , b ", ",")).toEqual(["a", "b"]);
    expect(splitLines("a\r\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("deep clones cycles and merges", () => {
    const source: { x: number; self?: unknown } = { x: 1 };
    source.self = source;
    const cloned = cloneDeep(source);
    expect(cloned).not.toBe(source);
    expect(cloned.self).toBe(cloned);
    expect(merge({ a: { x: 1 } }, { a: { y: 2 } })).toEqual({ a: { x: 1, y: 2 } });
  });

  it("limits async transforms", async () => {
    await expect(mapAsync([1, 2, 3], async (value) => value * 2, 2)).resolves.toEqual([2, 4, 6]);
  });

  it("serializes mutex work", async () => {
    const mutex = new Mutex();
    const output: number[] = [];
    await Promise.all(mapArray([1, 2, 3], (value) => mutex.use(async () => { output.push(value); })));
    expect(output).toEqual([1, 2, 3]);
  });

  it("times out", async () => {
    await expect(withTimeout(new Promise(() => {}), 5)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("supports strings and math", () => {
    expect(camelCase("Hello beautiful-river")).toBe("helloBeautifulRiver");
    expect(sumBy([{ n: 2 }, { n: 3 }], (value) => value.n)).toBe(5);
  });
});
