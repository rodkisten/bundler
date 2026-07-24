import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

export function env(name, fallback = "") {
  return process.env[name] ?? fallback;
}

export function boolEnv(name, fallback = false) {
  const value = env(name, String(fallback)).toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function resetDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
  return path;
}

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (options.capture) {
    if (result.stderr && !options.quiet) process.stderr.write(result.stderr);
  }

  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }

  return options.capture ? (result.stdout ?? "").trim() : result.status ?? 0;
}

export function runLogged(command, args, logPath, options = {}) {
  ensureDir(dirname(logPath));
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    stdio: "pipe",
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  writeFileSync(logPath, stdout + stderr);
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0 && !options.allowFailure) {
    process.exitCode = result.status ?? 1;
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
  return result.status ?? 0;
}

export function output(name, value) {
  const target = env("GITHUB_OUTPUT");
  if (!target) return;
  const text = String(value ?? "");
  if (text.includes("\n")) {
    const marker = `EOF_${name}_${Date.now()}`;
    appendFileSync(target, `${name}<<${marker}\n${text}\n${marker}\n`);
  } else {
    appendFileSync(target, `${name}=${text}\n`);
  }
}

const GITHUB_STEP_SUMMARY_MAX_BYTES = 1024 * 1024;
const GITHUB_STEP_SUMMARY_RESERVE_BYTES = 16 * 1024;

export function summary(markdown) {
  const target = env("GITHUB_STEP_SUMMARY");
  if (!target) return;

  const currentBytes = existsSync(target)
    ? Buffer.byteLength(readFileSync(target))
    : 0;
  const availableBytes = Math.max(
    0,
    GITHUB_STEP_SUMMARY_MAX_BYTES -
      GITHUB_STEP_SUMMARY_RESERVE_BYTES -
      currentBytes,
  );
  if (availableBytes === 0) return;

  const text = `${markdown.trimEnd()}\n`;
  const buffer = Buffer.from(text);
  if (buffer.byteLength <= availableBytes) {
    appendFileSync(target, buffer);
    return;
  }

  const notice = Buffer.from(
    "\n> Summary truncated because GitHub accepts at most 1024 KiB. " +
      "See the complete step log or uploaded artifact.\n",
  );
  const contentBytes = Math.max(0, availableBytes - notice.byteLength);
  appendFileSync(target, Buffer.concat([buffer.subarray(0, contentBytes), notice]));
}

export function readText(path, fallback = "") {
  return existsSync(path) ? readFileSync(path, "utf8") : fallback;
}

export function tail(path, count = 200) {
  const lines = readText(path).split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - count)).join("\n");
}

export function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(root);
  return files.sort();
}

export function copyTree(source, destination) {
  if (!existsSync(source)) return;
  cpSync(source, destination, { recursive: true, force: true });
}

export function relativeFiles(root) {
  return walkFiles(root).map((file) => relative(root, file));
}

export function json(value) {
  return JSON.stringify(value);
}
