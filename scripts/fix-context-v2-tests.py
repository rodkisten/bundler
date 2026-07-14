from pathlib import Path
import subprocess


def run(command: list[str], output: str) -> None:
    result = subprocess.run(command, text=True, capture_output=True)
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    Path(output).write_text(
        f"$ {' '.join(command)}\n\n{result.stdout}\n{result.stderr}\n\nexit={result.returncode}\n"
    )


run(["pnpm", "typecheck"], "artifacts/context-v2/typecheck.log")
run(
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
    "artifacts/context-v2/tests.log",
)

Path("scripts/fix-context-v2-tests.py").unlink()
