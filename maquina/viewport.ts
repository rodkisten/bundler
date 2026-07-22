export interface MaquinaLineRange {
  readonly fromLine: number;
  readonly toLine: number;
  readonly from: number;
  readonly to: number;
  readonly top: number;
}

export function getVisibleLineRange(
  value: string,
  scrollTop: number,
  viewportHeight: number,
  lineHeight: number,
  overscan = 12,
): MaquinaLineRange {
  const starts = getLineStarts(value);
  const lineCount = starts.length;
  const safeLineHeight = Math.max(1, lineHeight);
  const firstVisible = Math.floor(scrollTop / safeLineHeight);
  const visibleCount = Math.ceil(viewportHeight / safeLineHeight) + 1;
  const fromLine = clamp(firstVisible - overscan, 0, lineCount - 1);
  const toLine = clamp(
    firstVisible + visibleCount + overscan,
    fromLine + 1,
    lineCount,
  );
  const from = starts[fromLine] ?? 0;
  const to = starts[toLine] ?? value.length;

  return {
    fromLine,
    toLine,
    from,
    to,
    top: fromLine * safeLineHeight,
  };
}

export function getLineStarts(value: string): number[] {
  const starts = [0];

  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 10) {
      starts.push(index + 1);
    }
  }

  return starts;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
