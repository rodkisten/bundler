import type {
  MaquinaChange,
  MaquinaSelection,
} from "@rodkisten/maquina/types";

export interface MaquinaInputDiff {
  readonly changes: readonly MaquinaChange[];
  readonly selection: MaquinaSelection;
}

export function diffInputValue(
  previous: string,
  next: string,
  selection: MaquinaSelection,
): MaquinaInputDiff {
  if (previous === next) {
    return {
      changes: [],
      selection,
    };
  }

  let prefix = 0;
  const commonLength = Math.min(previous.length, next.length);

  while (
    prefix < commonLength &&
    previous.charCodeAt(prefix) === next.charCodeAt(prefix)
  ) {
    prefix += 1;
  }

  let previousSuffix = previous.length;
  let nextSuffix = next.length;

  while (
    previousSuffix > prefix &&
    nextSuffix > prefix &&
    previous.charCodeAt(previousSuffix - 1) ===
      next.charCodeAt(nextSuffix - 1)
  ) {
    previousSuffix -= 1;
    nextSuffix -= 1;
  }

  return {
    changes: [{
      from: prefix,
      to: previousSuffix,
      insert: next.slice(prefix, nextSuffix),
    }],
    selection,
  };
}
