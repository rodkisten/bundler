import { create, on, trustedHtml } from "./core/dom"

export type IconName = keyof typeof ICONS;

export type IconNode = SVGSVGElement | Text | string;


/* ******************** */
/* Constants            */
/* ******************** */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const DATA_ATTRIBUTE_PREFIX = "data-";

const ICONS = {
  add: '<path d="M5 12h14"/><path d="M12 5v14"/>',

  back: '<path d="m15 18-6-6 6-6"/>',

  bug: [
    '<path d="m8 2 1.88 1.88"/>',
    '<path d="M14.12 3.88 16 2"/>',
    '<path d="M9 7.13v-1a3 3 0 0 1 6 0v1"/>',
    '<path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>',
    '<path d="M12 20v-9"/>',
    '<path d="M6.53 9C4.6 8.8 3 7.1 3 5"/>',
    '<path d="M6 13H2"/>',
    '<path d="M3 21c0-2.1 1.7-3.8 3.8-4"/>',
    '<path d="M17.47 9C19.4 8.8 21 7.1 21 5"/>',
    '<path d="M18 13h4"/>',
    '<path d="M21 21c0-2.1-1.7-3.8-3.8-4"/>',
  ].join(""),

  clear: [
    '<path d="M3 6h18"/>',
    '<path d="M8 6V4h8v2"/>',
    '<path d="m19 6-1 14H6L5 6"/>',
    '<path d="M10 11v6"/>',
    '<path d="M14 11v6"/>',
  ].join(""),

  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',

  collapse: '<path d="m6 9 6 6 6-6"/>',

  console: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',

  copy: [
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>',
    '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  ].join(""),

  delete: [
    '<path d="M3 6h18"/>',
    '<path d="M8 6V4h8v2"/>',
    '<path d="m19 6-1 14H6L5 6"/>',
    '<path d="M10 11v6"/>',
    '<path d="M14 11v6"/>',
  ].join(""),

  diamond: [
    '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/>',
    '<path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/>',
    '<path d="M2 9h20"/>',
  ].join(""),

  download: [
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    '<path d="M7 10l5 5 5-5"/>',
    '<path d="M12 15V3"/>',
  ].join(""),

  edit: [
    '<path d="M12 20h9"/>',
    '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  ].join(""),

  elements: [
    '<path d="M4 4h16v16H4z"/>',
    '<path d="M4 9h16"/>',
    '<path d="M9 20V9"/>',
  ].join(""),

  expand: '<path d="m9 18 6-6-6-6"/>',

  eye: [
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>',
    '<circle cx="12" cy="12" r="3"/>',
  ].join(""),

  filter: [
    '<path d="M3 6h18"/>',
    '<path d="M7 12h10"/>',
    '<path d="M10 18h4"/>',
  ].join(""),

  forward: '<path d="m9 18 6-6-6-6"/>',

  info: [
    '<circle cx="12" cy="12" r="10"/>',
    '<path d="M12 16v-4"/>',
    '<path d="M12 8h.01"/>',
  ].join(""),

  inspect: [
    '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51Z"/>',
    '<path d="m13 13 6 6"/>',
  ].join(""),

  menu: [
    '<circle cx="12" cy="12" r="1"/>',
    '<circle cx="19" cy="12" r="1"/>',
    '<circle cx="5" cy="12" r="1"/>',
  ].join(""),

  network: [
    '<path d="M9 2 5 6l4 4"/>',
    '<path d="M5 6h11a4 4 0 0 1 0 8H8"/>',
    '<path d="m15 22 4-4-4-4"/>',
    '<path d="M19 18H8a4 4 0 0 1 0-8h8"/>',
  ].join(""),

  pause: [
    '<path d="M10 4H6v16h4Z"/>',
    '<path d="M18 4h-4v16h4Z"/>',
  ].join(""),

  play: '<path d="m5 3 14 9-14 9Z"/>',

  record: '<circle cx="12" cy="12" r="8"/>',

  refresh: [
    '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/>',
    '<path d="M3 3v5h5"/>',
    '<path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/>',
    '<path d="M21 21v-5h-5"/>',
  ].join(""),

  resources: [
    '<ellipse cx="12" cy="5" rx="9" ry="3"/>',
    '<path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/>',
    '<path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  ].join(""),

  search: [
    '<circle cx="11" cy="11" r="8"/>',
    '<path d="m21 21-4.3-4.3"/>',
  ].join(""),

  settings: [
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.73l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/>',
    '<circle cx="12" cy="12" r="3"/>',
  ].join(""),

  snippets: [
    '<circle cx="6" cy="6" r="3"/>',
    '<path d="M8.12 8.12 12 12"/>',
    '<path d="M20 4 8.12 15.88"/>',
    '<circle cx="6" cy="18" r="3"/>',
    '<path d="M14.8 14.8 20 20"/>',
  ].join(""),

  sources: [
    '<path d="m16 18 6-6-6-6"/>',
    '<path d="m8 6-6 6 6 6"/>',
  ].join(""),
} as const;


/* ******************** */
/* Icons                */
/* ******************** */

export function icon(name: IconName | string): IconNode {
  if (typeof document === "undefined") {
    return "•";
  }

  const body = ICONS[name as IconName];

  if (!body) {
    return document.createTextNode("•");
  }

  const svg = document.createElementNS(
    SVG_NAMESPACE,
    "svg",
  );

  setAttributes(svg, {
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  });

  svg.classList.add("roderuda-lucide-icon");

  svg.innerHTML = trustedHtml(body) as string;

  return svg;
}
