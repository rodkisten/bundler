import { describe, expect, it } from "vitest";
import {
  createRuntimeCompletionItems,
  createRuntimeCompletionResult,
  createScopeCompletionResult,
} from "@rodkisten/maquina/completion";

function labels(
  result: ReturnType<typeof createScopeCompletionResult>,
): string[] {
  return result?.options.map((item) => item.label) ?? [];
}

describe("Maquina lexical completions", () => {
  it("suggests variables and parameters visible in the active scope", () => {
    const value = [
      "const machine = { name: 'Máquina' };",
      "function run(message) {",
      "  const localValue = message;",
      "  loc",
    ].join("\n");
    const result = createScopeCompletionResult(value, value.length);

    expect(labels(result)).toContain("localValue");

    const parameterResult = createScopeCompletionResult(
      value.replace(/loc$/, "mes"),
      value.length,
    );

    expect(labels(parameterResult)).toContain("message");
  });

  it("does not leak bindings from a closed sibling block", () => {
    const value = [
      "{",
      "  const hiddenValue = 1;",
      "}",
      "const visibleValue = 2;",
      "vis",
    ].join("\n");
    const result = createScopeCompletionResult(value, value.length);
    const resultLabels = labels(result);

    expect(resultLabels).toContain("visibleValue");
    expect(resultLabels).not.toContain("hiddenValue");
  });

  it("suggests statically-known object literal members", () => {
    const value = [
      "const machine = {",
      "  name: 'Máquina',",
      "  poweredBy: [],",
      "  write(message) { return message; },",
      "};",
      "machine.w",
    ].join("\n");
    const result = createScopeCompletionResult(value, value.length);

    expect(labels(result)).toContain("write");
    expect(result?.from).toBe(value.length - 1);
  });
});

describe("Maquina runtime completions", () => {
  it("omits getter and setter properties without invoking them", () => {
    const target: Record<string, unknown> = {};
    let getterCalls = 0;

    Object.defineProperty(target, "dangerousGetter", {
      configurable: true,
      get() {
        getterCalls += 1;
        return "boom";
      },
    });
    Object.defineProperty(target, "writeOnly", {
      configurable: true,
      set(_value: unknown) {},
    });
    Object.defineProperty(target, "safeValue", {
      configurable: true,
      enumerable: true,
      value: 42,
    });

    const items = createRuntimeCompletionItems(target, "");
    const itemLabels = items.map((item) => item.label);

    expect(itemLabels).toContain("safeValue");
    expect(itemLabels).not.toContain("dangerousGetter");
    expect(itemLabels).not.toContain("writeOnly");
    expect(itemLabels).not.toContain("constructor");
    expect(getterCalls).toBe(0);
  });

  it("resolves a simple local alias to a runtime object", () => {
    const runtimeRoot = {
      console: {
        log() {},
        warn() {},
      },
    } as unknown as Window;
    const value = "const logger = console;\nlogger.l";
    const result = createRuntimeCompletionResult(
      value,
      value.length,
      runtimeRoot,
    );

    expect(result?.options.map((item) => item.label)).toContain("log");
  });
});
