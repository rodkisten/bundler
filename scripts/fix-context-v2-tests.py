from pathlib import Path
import subprocess


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}:\n{old[:220]}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/fabrica/dom.ts",
    '''function hasPotentialComponentChildren(
  part: Extract<TemplatePart, { type: "component" }> | undefined,
  values: readonly RenderValue[],
  template: DocumentFragment,
): boolean {
  if (part?.hasStaticChildren || hasMeaningfulComponentChildren(template)) return true;

  const childParts = part?.orderedChildParts ?? [];
  for (let index = 0; index < childParts.length; index += 1) {
    const childPart = childParts[index];
    if (!childPart) continue;
    if (childPart.type === "component") return true;
    if (childPart.type !== "child") continue;
    if (hasMeaningfulRenderValue(values[childPart.index])) return true;
  }

  return false;
}

function hasMeaningfulRenderValue(value: RenderValue | undefined): boolean {
  if (isDirective(value) || isSignal(value)) return true;

  const resolved = readValue(value) as RenderValue;
  if (resolved == null || resolved === false || resolved === true) return false;
  if (Array.isArray(resolved)) return resolved.some((item) => hasMeaningfulRenderValue(item));
  if (typeof resolved === "string") return resolved.trim().length > 0;
  if (resolved instanceof DocumentFragment) return hasMeaningfulComponentChildren(resolved);
  return true;
}
''',
    '''function hasPotentialComponentChildren(
  part: Extract<TemplatePart, { type: "component" }> | undefined,
  values: readonly RenderValue[],
  template: DocumentFragment,
): boolean {
  if (part?.hasStaticChildren || hasMeaningfulComponentChildren(template)) return true;

  const childParts = part?.orderedChildParts ?? [];
  for (let index = 0; index < childParts.length; index += 1) {
    const childPart = childParts[index];
    if (!childPart) continue;
    if (childPart.type === "component") return true;
    if (childPart.type !== "child") continue;

    // Inspect the raw interpolation without executing callbacks or signals.
    // Arrays, directives, signals, component requests and render functions are
    // potentially meaningful even when their current DOM is not materialized.
    const value = values[childPart.index];
    if (value == null || value === false || value === true || value === "") continue;
    return true;
  }

  return false;
}
''',
)

replace_once(
    "src/maquina/maquina.test.ts",
    '''    const textarea = parent.querySelector("textarea")!;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));''',
    '''    const textarea = parent.querySelector("textarea")!;
    textarea.value = "doc";
    textarea.setSelectionRange(3, 3);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));''',
)

result = subprocess.run(["pnpm", "test"], text=True, capture_output=True)
Path("artifacts/context-v2/full-tests.log").write_text(
    f"{result.stdout}\n{result.stderr}\nexit={result.returncode}\n"
)
Path("scripts/fix-context-v2-tests.py").unlink()
