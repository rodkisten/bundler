export const SITE_ORIGIN = "https://rod.migos.club";
export const BUNDLER_BASE_PATH = "/bundler";

export type EcosystemProjectId =
  | "docs"
  | "broto"
  | "fabrica"
  | "cipo"
  | "maquina"
  | "devtools"
  | "nascente";

export type EcosystemProject = {
  readonly id: EcosystemProjectId;
  readonly name: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly path: string;
  readonly accent: string;
};

export const ECOSYSTEM_PROJECTS: readonly EcosystemProject[] = [
  {
    id: "docs",
    name: "Rod Docs",
    eyebrow: "Ecosystem map",
    description: "Documentation, source, tests, pipelines, benchmarks and browser bundles for the Rod ecosystem.",
    path: `${BUNDLER_BASE_PATH}/`,
    accent: "#d7ff4f",
  },
  {
    id: "broto",
    name: "Broto",
    eyebrow: "Reactive runtime",
    description: "Fine-grained signals, effects, stores, ownership and async resources for small browser runtimes.",
    path: `${BUNDLER_BASE_PATH}/broto/`,
    accent: "#a6ff80",
  },
  {
    id: "fabrica",
    name: "Fábrica",
    eyebrow: "DOM runtime",
    description: "A fine-grained HTML and component runtime built around real DOM, Broto reactivity and compiler parity.",
    path: `${BUNDLER_BASE_PATH}/fabrica/`,
    accent: "#ff7a59",
  },
  {
    id: "cipo",
    name: "Cipó",
    eyebrow: "CSS runtime",
    description: "Browser-first semantic CSS that compiles into deduplicated atomic styles at runtime and build time.",
    path: `${BUNDLER_BASE_PATH}/cipo/`,
    accent: "#c9ff59",
  },
  {
    id: "maquina",
    name: "Máquina",
    eyebrow: "Code editor",
    description: "A compact browser code editor designed for touch, embedded tooling and the Rod runtime stack.",
    path: `${BUNDLER_BASE_PATH}/maquina/`,
    accent: "#92aaff",
  },
  {
    id: "devtools",
    name: "Rod DevTools",
    eyebrow: "Browser instrumentation",
    description: "Mobile-first browser DevTools with console, elements, network, sources and runtime inspection.",
    path: `${BUNDLER_BASE_PATH}/devtools/`,
    accent: "#ff3d81",
  },
  {
    id: "nascente",
    name: "Nascente",
    eyebrow: "Utility toolkit",
    description: "Allocation-conscious utilities for arrays, collections, strings, concurrency and browser hot paths.",
    path: `${BUNDLER_BASE_PATH}/nascente/`,
    accent: "#67e8f9",
  },
] as const;

export const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/rodkisten" },
  { label: "Instagram", href: "https://www.instagram.com/rodkisten/" },
  { label: "X / Twitter", href: "https://x.com/therodkisten" },
  { label: "Website", href: SITE_ORIGIN },
] as const;

export function getEcosystemProject(id: EcosystemProjectId): EcosystemProject {
  const project = ECOSYSTEM_PROJECTS.find((candidate) => candidate.id === id);
  if (!project) throw new Error(`Unknown ecosystem project: ${id}`);
  return project;
}

export function absoluteSiteUrl(pathname: string): string {
  return new URL(pathname, SITE_ORIGIN).toString();
}

export function renderEcosystemNavigation(currentId: EcosystemProjectId): string {
  const links = ECOSYSTEM_PROJECTS.map((project) => {
    const active = project.id === currentId ? ' aria-current="page" data-active' : "";
    return `<a href="${project.path}"${active}>${escapeHtml(project.name)}</a>`;
  }).join("");

  return `<nav class="rod-ecosystem-nav" data-rod-ecosystem-nav aria-label="Rod ecosystem">
    <a class="rod-ecosystem-brand" href="${BUNDLER_BASE_PATH}/" aria-label="Rod ecosystem home"><span>R</span><strong>Rod / bundler</strong></a>
    <div class="rod-ecosystem-links">${links}</div>
  </nav>`;
}

export function renderEcosystemFooter(): string {
  const socials = SOCIAL_LINKS.map((link) => `<a href="${link.href}" target="_blank" rel="me noopener noreferrer">${escapeHtml(link.label)}</a>`).join("");
  return `<footer class="rod-ecosystem-footer" data-rod-ecosystem-footer>
    <div><strong>Built by Rod Kisten.</strong><span>Small runtimes, sharp tools, strange little forests.</span></div>
    <nav aria-label="Rod Kisten social links">${socials}</nav>
  </footer>`;
}

export const ECOSYSTEM_SHELL_CSS = `
.rod-ecosystem-nav,
.rod-ecosystem-footer {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  box-sizing: border-box;
}
.rod-ecosystem-nav *,
.rod-ecosystem-footer * {
  box-sizing: border-box;
}
.rod-ecosystem-nav {
  position: relative;
  z-index: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  width: min(1480px, calc(100% - 8px));
  margin: max(10px, env(safe-area-inset-top)) auto 0;
  padding: 10px;
  border: 1px solid rgb(255 255 255/0.16);
  border-radius: 22px;
  background: rgb(8 8 8 / 0.76);
  color: #f7f8ff;
  box-shadow: 0 20px 70px rgb(0 0 0/0.25);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
}
.rod-ecosystem-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 0 0 auto;
  color: inherit;
  text-decoration: none;
  font-size: 0.82rem;
  letter-spacing: -0.02em;
}
.rod-ecosystem-brand span {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: #f7f8ff;
  color: #090b11;
  font-weight: 950;
}
.rod-ecosystem-links {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.rod-ecosystem-links::-webkit-scrollbar {
  display: none;
}
.rod-ecosystem-links a {
  flex: 0 0 auto;
  padding: 8px 11px;
  border-radius: 11px;
  color: #bec4d3;
  text-decoration: none;
  font-size: 0.78rem;
  font-weight: 760;
  white-space: nowrap;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}
.rod-ecosystem-links a:hover,
.rod-ecosystem-links a[data-active] {
  background: rgb(255 255 255/0.11);
  color: #fff;
}
.rod-ecosystem-links a:active {
  transform: scale(0.97);
}
.rod-ecosystem-footer {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  width: min(1480px, calc(100% - 24px));
  margin: 80px auto max(16px, env(safe-area-inset-bottom));
  padding: 24px;
  border: 1px solid rgb(255 255 255/0.13);
  border-radius: 24px;
  background: rgb(8 10 16/0.66);
  color: #f4f6ff;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.rod-ecosystem-footer > div {
  display: grid;
  gap: 5px;
}
.rod-ecosystem-footer strong {
  font-size: 0.94rem;
}
.rod-ecosystem-footer span {
  color: #9da6ba;
  font-size: 0.82rem;
}
.rod-ecosystem-footer nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.rod-ecosystem-footer a {
  padding: 7px 10px;
  border: 1px solid rgb(255 255 255/0.12);
  border-radius: 999px;
  color: #dfe4f0;
  text-decoration: none;
  font-size: 0.78rem;
}
.rod-ecosystem-footer a:hover {
  background: rgb(255 255 255/0.1);
  color: #fff;
}
@media (max-width: 760px) {
  .rod-ecosystem-nav {
    align-items: flex-start;
    flex-direction: column;
    border-radius: 20px;
  }
  .rod-ecosystem-links {
    width: 100%;
  }
  .rod-ecosystem-footer {
    flex-direction: column;
  }
  .rod-ecosystem-footer nav {
    justify-content: flex-start;
  }
}
`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
