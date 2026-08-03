import type {
  MaquinaChange,
  MaquinaSelection,
  MaquinaTransaction,
} from "@rodkisten/maquina/types";

export interface MaquinaDocumentSnapshot {
  readonly value: string;
  readonly selection: MaquinaSelection;
  readonly version: number;
}

export interface MaquinaAppliedTransaction {
  readonly snapshot: MaquinaDocumentSnapshot;
  readonly inverse: MaquinaTransaction;
}

export function createDocumentSnapshot(
  value: string,
  selection: MaquinaSelection = {
    anchor: value.length,
    head: value.length,
  },
  version = 0,
): MaquinaDocumentSnapshot {
  return {
    value,
    selection: normalizeSelection(selection, value.length),
    version,
  };
}

export function applyDocumentTransaction(
  snapshot: MaquinaDocumentSnapshot,
  transaction: MaquinaTransaction,
): MaquinaAppliedTransaction {
  const changes = normalizeChanges(
    transaction.changes ?? [],
    snapshot.value.length,
  );

  if (changes.length === 0) {
    const selection = normalizeSelection(
      transaction.selection ?? snapshot.selection,
      snapshot.value.length,
    );

    return {
      snapshot: {
        value: snapshot.value,
        selection,
        version: snapshot.version + 1,
      },
      inverse: {
        selection: snapshot.selection,
        origin: "history",
      },
    };
  }

  let value = snapshot.value;
  const inverseChanges: MaquinaChange[] = [];
  let delta = 0;

  for (const change of changes) {
    const from = change.from + delta;
    const to = change.to + delta;
    const removed = value.slice(from, to);

    value = value.slice(0, from) + change.insert + value.slice(to);

    inverseChanges.unshift({
      from,
      to: from + change.insert.length,
      insert: removed,
    });

    delta += change.insert.length - (change.to - change.from);
  }

  const selection = normalizeSelection(
    transaction.selection ?? mapSelection(snapshot.selection, changes),
    value.length,
  );

  return {
    snapshot: {
      value,
      selection,
      version: snapshot.version + 1,
    },
    inverse: {
      changes: inverseChanges,
      selection: snapshot.selection,
      origin: "history",
    },
  };
}

export function replaceDocument(
  snapshot: MaquinaDocumentSnapshot,
  value: string,
  selection?: MaquinaSelection,
  origin: MaquinaTransaction["origin"] = "api",
): MaquinaAppliedTransaction {
  return applyDocumentTransaction(snapshot, {
    changes: [{
      from: 0,
      to: snapshot.value.length,
      insert: value,
    }],
    selection: selection ?? {
      anchor: value.length,
      head: value.length,
    },
    origin,
  });
}

export function normalizeSelection(
  selection: MaquinaSelection,
  length: number,
): MaquinaSelection {
  return {
    anchor: clamp(selection.anchor, 0, length),
    head: clamp(selection.head, 0, length),
  };
}

function normalizeChanges(
  changes: readonly MaquinaChange[],
  length: number,
): MaquinaChange[] {
  const normalized = changes
    .map((change) => ({
      from: clamp(change.from, 0, length),
      to: clamp(change.to, 0, length),
      insert: change.insert,
    }))
    .map((change) => ({
      ...change,
      from: Math.min(change.from, change.to),
      to: Math.max(change.from, change.to),
    }))
    .sort((left, right) => left.from - right.from);

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];

    if (previous && current && current.from < previous.to) {
      throw new Error("[Maquina] Transaction changes cannot overlap");
    }
  }

  return normalized;
}

function mapSelection(
  selection: MaquinaSelection,
  changes: readonly MaquinaChange[],
): MaquinaSelection {
  return {
    anchor: mapPosition(selection.anchor, changes),
    head: mapPosition(selection.head, changes),
  };
}

function mapPosition(
  position: number,
  changes: readonly MaquinaChange[],
): number {
  let mapped = position;

  for (const change of changes) {
    if (position < change.from) {
      break;
    }

    if (position <= change.to) {
      mapped = change.from + change.insert.length;
      continue;
    }

    mapped += change.insert.length - (change.to - change.from);
  }

  return mapped;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
