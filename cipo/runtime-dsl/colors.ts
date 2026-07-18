export function expandRuntimeColorUtilities(input: string): string {
  let output = "";
  let line = "";

  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index] || "\n";
    if (char !== "\n" && char !== "\r") {
      line += char;
      continue;
    }

    const expanded = expandColorUtilityLine(line);
    output += expanded + char;
    line = "";
  }

  return output;
}

function expandColorUtilityLine(line: string): string {
  const indentSize = line.length - line.trimStart().length;
  const indent = line.slice(0, indentSize);
  const trimmed = line.trim().replace(/;$/, "");
  if (
    !trimmed ||
    trimmed.includes(":") ||
    trimmed.includes("{") ||
    trimmed.includes("}")
  )
    return line;

  const match = /^(bg|color)-([a-z]+)-([0-9]{1,3})$/.exec(trimmed);
  if (!match) return line;

  const property = match[1] === "bg" ? "background" : "color";
  return `${indent}${property}: ${createOklchUtilityColor(match[2]!, Number(match[3]))}`;
}

const HUE_BY_NAME: Record<string, number> = {
  slate: 260,
  gray: 260,
  zinc: 260,
  neutral: 260,
  stone: 60,
  red: 29,
  orange: 45,
  amber: 72,
  yellow: 92,
  lime: 125,
  green: 150,
  emerald: 162,
  teal: 185,
  cyan: 215,
  sky: 240,
  blue: 260,
  indigo: 278,
  violet: 300,
  purple: 315,
  fuchsia: 334,
  pink: 350,
  rose: 18,
  accent: 205,
};

export function createOklchUtilityColor(name: string, shade: number): string {
  const safeShade = Math.max(
    0,
    Math.min(999, Number.isFinite(shade) ? shade : 500),
  );
  const t = safeShade / 999;
  const hue = HUE_BY_NAME[name] ?? hashHue(name);
  const lightness = clamp(0.16 + (1 - t) * 0.76, 0.12, 0.96);
  const chroma = clamp(0.04 + Math.sin(Math.PI * t) * 0.24, 0.035, 0.28);
  return `oklch(${round(lightness)} ${round(chroma)} ${round(hue)})`;
}

function hashHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1)
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return hash % 360;
}


function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}
