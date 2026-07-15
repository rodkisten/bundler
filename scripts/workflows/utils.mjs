import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

export function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : value;
}

export function envBoolean(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr?.trim();
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}${stderr ? `\n${stderr}` : ""}`);
  }

  return options.capture ? (result.stdout ?? "").trim() : "";
}

export function git(args, options = {}) {
  return run("git", args, { ...options, capture: true });
}

export function writeOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  const stringValue = String(value ?? "");
  if (stringValue.includes("\n")) {
    const delimiter = `ROD_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    appendFileSync(output, `${name}<<${delimiter}\n${stringValue}\n${delimiter}\n`);
  } else {
    appendFileSync(output, `${name}=${stringValue}\n`);
  }
}

export function appendSummary(markdown) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `${markdown.trimEnd()}\n`);
}

export function ensureEmptyDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

export function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files.push(path);
    }
  };
  visit(root);
  return files.sort();
}

export function copyFilePreservingRoot(file, sourceRoot, destinationRoot) {
  const target = join(destinationRoot, relative(sourceRoot, file));
  mkdirSync(dirname(target), { recursive: true });
  cpSync(file, target);
  return target;
}

export function copyTree(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

export function fileName(path) {
  return basename(path);
}

export async function githubJson(path, { token = env("GH_TOKEN"), method = "GET", body } = {}) {
  const repository = env("GITHUB_REPOSITORY");
  if (!repository) throw new Error("GITHUB_REPOSITORY is required");
  const url = path.startsWith("http") ? path : `https://api.github.com/repos/${repository}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub API ${method} ${url} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function runLogged(command, args, logPath, options = {}) {
  const { createWriteStream } = await import("node:fs");
  const { spawn } = await import("node:child_process");
  mkdirSync(dirname(logPath), { recursive: true });
  const log = createWriteStream(logPath, { flags: "w" });
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["inherit", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => { process.stdout.write(chunk); log.write(chunk); });
    child.stderr.on("data", (chunk) => { process.stderr.write(chunk); log.write(chunk); });
    child.on("error", (error) => { log.end(); reject(error); });
    child.on("close", (code) => {
      log.end();
      if (code === 0 || options.allowFailure) resolve(code ?? 0);
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}
