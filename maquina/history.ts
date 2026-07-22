import type { MaquinaTransaction } from "@rodkisten/maquina/types";

export interface MaquinaHistoryEntry {
  readonly undo: MaquinaTransaction;
  readonly redo: MaquinaTransaction;
}

export class MaquinaHistory {
  readonly #undo: MaquinaHistoryEntry[] = [];
  readonly #redo: MaquinaHistoryEntry[] = [];
  readonly #limit: number;

  constructor(limit = 200) {
    this.#limit = Math.max(1, limit);
  }

  push(entry: MaquinaHistoryEntry): void {
    this.#undo.push(entry);

    if (this.#undo.length > this.#limit) {
      this.#undo.shift();
    }

    this.#redo.length = 0;
  }

  takeUndo(): MaquinaHistoryEntry | undefined {
    const entry = this.#undo.pop();

    if (entry) {
      this.#redo.push(entry);
    }

    return entry;
  }

  takeRedo(): MaquinaHistoryEntry | undefined {
    const entry = this.#redo.pop();

    if (entry) {
      this.#undo.push(entry);
    }

    return entry;
  }

  clear(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
  }

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }
}
