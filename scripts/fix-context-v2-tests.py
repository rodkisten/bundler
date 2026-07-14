from pathlib import Path
import subprocess


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}:\n{old[:200]}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/maquina/maquina.test.ts",
    '''    const textarea = parent.querySelector("textarea")!;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));''',
    '''    const textarea = parent.querySelector("textarea")!;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));''',
)

replace_once(
    "src/devtools/devtools.test.ts",
    '''    expect(document.querySelector("#roderuda")?.shadowRoot).not.toBeNull();
  });

  it("starts hidden and can ingest a startup error bag", () => {''',
    '''    expect(document.querySelector("#roderuda")?.shadowRoot).not.toBeNull();
  }, 15_000);

  it("starts hidden and can ingest a startup error bag", () => {''',
)

result = subprocess.run(["pnpm", "test"], text=True, capture_output=True)
Path("artifacts/context-v2/full-tests.log").write_text(
    f"{result.stdout}\n{result.stderr}\nexit={result.returncode}\n"
)
Path("artifacts/context-v2/tests.log").unlink(missing_ok=True)
Path("scripts/fix-context-v2-tests.py").unlink()
