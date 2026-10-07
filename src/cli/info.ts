/**
 * `rewap info` — what is installed, and what it contains.
 *
 * Reads the package's own manifest and, when the build is present, the size of
 * each entry point. Sizes are raw file sizes on disk with a gzipped column for the
 * JavaScript; no benchmarks, no invented numbers, and nothing here touches the
 * network.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { packageRoot } from "./templates";

export interface EntryPointInfo {
  subpath: string;
  file: string;
  bytes: number;
  gzipBytes: number | null;
}

export interface InfoReport {
  name: string;
  version: string;
  license: string;
  homepage: string;
  node: string;
  peer: Record<string, string>;
  entries: EntryPointInfo[];
  stylesheets: { subpath: string; file: string; bytes: number }[];
  built: boolean;
}

/** An export target: a path, or the condition map that wraps one. */
type ExportTarget = string | { types?: string; default?: string };
interface ConditionalTarget {
  import?: ExportTarget;
  require?: ExportTarget;
  types?: string;
  default?: string;
}

interface Manifest {
  name?: string;
  version?: string;
  license?: string;
  homepage?: string;
  engines?: { node?: string };
  peerDependencies?: Record<string, string>;
  exports?: Record<string, ExportTarget | ConditionalTarget>;
}

/**
 * The ESM runtime file of an export target.
 *
 * The package publishes nested conditions (`import`/`require`, each with its own
 * `types` and `default`), so a single `typeof value === "string"` check is not
 * enough — reading `value.import` directly hands a file the *object* instead of a
 * path. Returns `null` when the target has no runtime file.
 */
const runtimeFile = (value: ExportTarget | ConditionalTarget | undefined): string | null => {
  if (value === undefined) return null;
  if (typeof value === "string") return value;
  if ("import" in value || "require" in value) return runtimeFile(value.import ?? value.require);
  return typeof value.default === "string" ? value.default : null;
};

export const info = (): InfoReport => {
  const manifestPath = join(packageRoot, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const exports = manifest.exports ?? {};

  const entries: EntryPointInfo[] = [];
  const stylesheets: InfoReport["stylesheets"] = [];

  for (const [subpath, value] of Object.entries(exports)) {
    if (subpath === "./package.json") continue;
    const relative = runtimeFile(value);
    if (!relative) continue;
    const file = join(packageRoot, relative.replace(/^\.\//, ""));
    if (!existsSync(file)) continue;
    const bytes = statSync(file).size;

    if (relative.endsWith(".css")) {
      stylesheets.push({ subpath, file: relative, bytes });
      continue;
    }

    entries.push({
      subpath,
      file: relative,
      bytes,
      gzipBytes: relative.endsWith(".js") ? gzipSync(readFileSync(file)).length : null,
    });
  }

  return {
    name: manifest.name ?? "@nashiuso/rewap",
    version: manifest.version ?? "0.0.0",
    license: manifest.license ?? "MIT",
    homepage: manifest.homepage ?? "https://github.com/nashisuso/rewap#readme",
    node: manifest.engines?.node ?? ">=18.18.0",
    peer: manifest.peerDependencies ?? {},
    entries: entries.sort((a, b) => a.subpath.localeCompare(b.subpath)),
    stylesheets: stylesheets.sort((a, b) => a.subpath.localeCompare(b.subpath)),
    built: entries.length > 0,
  };
};

export const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} kB`;
