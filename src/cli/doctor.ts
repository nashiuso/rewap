/**
 * `rewap doctor` — checks a project against the things this library actually
 * cares about, and nothing else.
 *
 * Every check is local: it reads files, `package.json` and the installed tree. It
 * never calls the network, never installs anything and never edits the project it
 * is inspecting. A check that cannot run (no `node_modules`, for instance) reports
 * `skip` with the reason rather than a guess.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export interface Check {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
  /** What to do about it, when the status is not `ok`. */
  hint?: string;
}

export interface DoctorReport {
  directory: string;
  checks: Check[];
  failures: number;
  warnings: number;
}

const readJson = (file: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const installedVersion = (directory: string, name: string): string | null => {
  const manifest = join(directory, "node_modules", name, "package.json");
  if (!existsSync(manifest)) return null;
  const parsed = readJson(manifest);
  return typeof parsed?.version === "string" ? parsed.version : null;
};

const sourceFiles = (directory: string, limit = 4000): string[] => {
  const roots = ["src", "app", "pages", "components"]
    .map((entry) => join(directory, entry))
    .filter(existsSync);
  const files: string[] = [];
  const walk = (path: string): void => {
    if (files.length >= limit) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?|mjs|astro|css|html)$/.test(entry.name))
        files.push(full);
    }
  };
  for (const root of roots) walk(root);
  return files;
};

const requiredNodeMajor = 18;
const requiredNodeMinor = 18;

export const doctor = (
  target = process.cwd(),
  expectedVersion = "1.1.1",
): DoctorReport => {
  const directory = resolve(target);
  const checks: Check[] = [];
  const add = (check: Check): void => {
    checks.push(check);
  };

  const [major, minor] = process.versions.node.split(".").map(Number) as [
    number,
    number,
  ];
  add({
    id: "node",
    title: "Node version",
    status:
      major > requiredNodeMajor ||
      (major === requiredNodeMajor && minor >= requiredNodeMinor)
        ? "ok"
        : "fail",
    detail: `running ${process.versions.node}; the build scripts need >= ${requiredNodeMajor}.${requiredNodeMinor}`,
    hint: "Update Node, or use a version manager to pin one.",
  });

  const manifestPath = join(directory, "package.json");
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
  add(
    manifest
      ? {
          id: "package",
          title: "package.json",
          status: "ok",
          detail: manifestPath,
        }
      : {
          id: "package",
          title: "package.json",
          status: "fail",
          detail: `not found in ${directory}`,
          hint: "Run this from a project directory, or pass the path: rewap doctor path/to/project",
        },
  );

  if (!manifest) {
    return summarize(directory, checks);
  }

  const dependencies = {
    ...(manifest.dependencies as object),
    ...(manifest.devDependencies as object),
  } as Record<string, string>;
  const declared = dependencies["@nashiuso/rewap"];
  const installed = installedVersion(directory, "@nashiuso/rewap");

  add(
    declared || installed
      ? {
          id: "rewap",
          title: "@nashiuso/rewap",
          status: installed ? "ok" : "warn",
          detail: installed
            ? `installed ${installed}${declared ? `, declared ${declared}` : ""}`
            : `declared ${declared} but not installed`,
          ...(installed
            ? {}
            : {
                hint: "Run your package manager's install command in this project.",
              }),
        }
      : {
          id: "rewap",
          title: "@nashiuso/rewap",
          status: "warn",
          detail: "not declared in this project",
          hint: "npm install @nashiuso/rewap",
        },
  );

  if (installed && installed !== expectedVersion) {
    add({
      id: "rewap-version",
      title: "rewap version",
      status: "warn",
      detail: `installed ${installed}, this CLI is ${expectedVersion}`,
      hint: "The CLI scaffolds and inspects; it does not have to match the installed runtime exactly, but keep them close.",
    });
  }

  const react = installedVersion(directory, "react");
  add(
    react
      ? {
          id: "react",
          title: "react",
          status: Number(react.split(".")[0]) >= 18 ? "ok" : "fail",
          detail: `installed ${react}; the peer range is >=18.0.0`,
          ...(Number(react.split(".")[0]) >= 18
            ? {}
            : { hint: "Upgrade React to 18 or newer." }),
        }
      : {
          id: "react",
          title: "react",
          status: "skip",
          detail: "not installed here (fine if this is not a React project)",
        },
  );

  const files = sourceFiles(directory);
  const stylesheet = files.find((file) =>
    /@nashiuso\/rewap\/(styles|tokens)\.css/.test(readFileSafe(file)),
  );
  add(
    stylesheet
      ? {
          id: "stylesheet",
          title: "library stylesheet",
          status: "ok",
          detail: `imported in ${stylesheet.replace(directory + sep, "")}`,
        }
      : {
          id: "stylesheet",
          title: "library stylesheet",
          status: "warn",
          detail: "no import of @nashiuso/rewap/styles.css found",
          hint: "Without it the placeholder, the dragged state and the widget chrome have no styles. Import it once, or bring your own.",
        },
  );

  const cdn = files.filter((file) =>
    /cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/.test(
      readFileSafe(file),
    ),
  );
  add(
    cdn.length === 0
      ? {
          id: "cdn",
          title: "no CDN references",
          status: "ok",
          detail: "nothing in source points at a CDN",
        }
      : {
          id: "cdn",
          title: "no CDN references",
          status: "warn",
          detail: `${cdn.length} file(s) reference a CDN: ${cdn
            .slice(0, 3)
            .map((file) => file.replace(directory + sep, ""))
            .join(", ")}`,
          hint: "The library does not need one. If these are your own dependencies, that is your call — but the layout will not.",
        },
  );

  const lockfiles = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ].filter((file) => existsSync(join(directory, file)));
  add(
    lockfiles.length <= 1
      ? {
          id: "lockfile",
          title: "one lockfile",
          status: lockfiles.length === 1 ? "ok" : "skip",
          detail: lockfiles[0] ?? "no lockfile yet",
        }
      : {
          id: "lockfile",
          title: "one lockfile",
          status: "warn",
          detail: lockfiles.join(", "),
          hint: "Two package managers in one project is how installs start disagreeing with each other.",
        },
  );

  const rewapFiles = files.filter((file) =>
    /@nashiuso\/rewap/.test(readFileSafe(file)),
  );
  const usesSubpath = rewapFiles.some((file) =>
    /@nashiuso\/rewap\/(utilities|providers|charts|widgets|math|motion)/.test(
      readFileSafe(file),
    ),
  );
  add({
    id: "subpaths",
    title: "optional modules",
    status: "ok",
    detail: usesSubpath
      ? "subpath imports found — the optional modules are pulled in explicitly"
      : "only the root import is used, so charts, widgets and providers stay out of the bundle",
  });

  const reactQuery = existsSync(join(directory, "src"));
  if (!reactQuery) {
    add({
      id: "src",
      title: "src directory",
      status: "skip",
      detail: "no src directory to inspect",
    });
  }

  return summarize(directory, checks);
};

const readFileSafe = (file: string): string => {
  try {
    return statSync(file).size > 512_000 ? "" : readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

const summarize = (directory: string, checks: Check[]): DoctorReport => ({
  directory,
  checks,
  failures: checks.filter((check) => check.status === "fail").length,
  warnings: checks.filter((check) => check.status === "warn").length,
});
