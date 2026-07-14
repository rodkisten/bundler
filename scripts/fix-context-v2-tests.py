from pathlib import Path
import subprocess


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}:\n{old[:240]}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/fabrica/dom.ts",
    '''      const hasMeaningfulChildren = hasCompiledChildren
        && (part?.hasStaticChildren || hasMeaningfulComponentChildren(node.content));''',
    '''      // Ordered child parts may be comments only until their dynamic values
      // are bound, so pre-materialization DOM inspection cannot detect them.
      const hasMeaningfulChildren = hasCompiledChildren;''',
)

replace_once(
    "src/fabrica/dom.ts",
    '''      if (touchesDynamicPart) normalizations.push(text);
      else removals.push(text);''',
    '''      if (touchesDynamicPart && !(parent instanceof DocumentFragment)) {
        normalizations.push(text);
      } else {
        removals.push(text);
      }''',
)

replace_once(
    "src/maquina/editor.ts",
    '''  if (!root || !textarea || !highlight || !suggestions) throw new Error("[Maquina] Editor failed to mount");

  applyTheme(root, theme.name);''',
    '''  if (!root || !textarea || !highlight || !suggestions) throw new Error("[Maquina] Editor failed to mount");

  // Property bindings are intentionally mirrored here so standalone/editor
  // adapters always expose the initial value and cursor synchronously.
  textarea.value = options.value;
  textarea.setSelectionRange(options.value.length, options.value.length);

  applyTheme(root, theme.name);''',
)

result = subprocess.run(
    [
        "pnpm", "vitest", "run",
        "src/fabrica/tests/fabrica.component-render.test.ts",
        "src/fabrica/tests/fabrica.context-architecture.test.ts",
        "src/devtools/core/context.test.ts",
        "src/devtools/panels/elements.test.ts",
        "src/devtools/panels/resources.test.ts",
        "src/devtools/panels/sources.test.ts",
        "src/devtools/devtools.mount.test.ts",
        "src/devtools/devtools.test.ts",
        "src/maquina/maquina.test.ts",
    ],
    text=True,
    capture_output=True,
)
Path("artifacts/context-v2/tests.log").write_text(
    f"{result.stdout}\n{result.stderr}\nexit={result.returncode}\n"
)
Path("artifacts/context-v2/typecheck.log").unlink(missing_ok=True)
Path("scripts/fix-context-v2-tests.py").unlink()
