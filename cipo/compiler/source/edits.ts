export interface SourceEdit {
  readonly start: number
  readonly end: number
  readonly value: string
}

/** Applies sorted, non-overlapping source edits while preserving untouched text byte-for-byte. */
export function applyEdits(source: string, edits: readonly SourceEdit[]): string {
  const sorted = [...edits].sort((left, right) => left.start - right.start || left.end - right.end)
  let output = ''
  let cursor = 0

  for (const edit of sorted) {
    if (edit.start < cursor) {
      throw new Error(`Overlapping source edits at ${edit.start}-${edit.end}; previous edit ended at ${cursor}.`)
    }
    output += source.slice(cursor, edit.start)
    output += edit.value
    cursor = edit.end
  }

  return output + source.slice(cursor)
}

/** Returns whether a source range intersects any pending edit. */
export function overlapsAny(start: number, end: number, edits: readonly SourceEdit[]): boolean {
  return edits.some((edit) => start < edit.end && end > edit.start)
}
