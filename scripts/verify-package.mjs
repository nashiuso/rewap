#!/usr/bin/env node
/**
 * Packs the library the way `npm publish` would, installs the resulting
 * tarball into a scratch project, and imports every public entry point from
 * there — not from the repository's `node_modules` symlink, which would quietly
 * pass even if `files` or `exports` were wrong.
 *
 * This is slower than trusting `tsup`'s exit code, which is exactly the point:
 * `npm run build` succeeding only proves the compiler was happy. It does not
 * prove the tarball a consumer installs actually contains and resolves
 * everything `exports` promises.
 */
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(join(root, "package.json"), "utf8"),
);

function log(step) {
  console.log(`\n→ ${step}`);
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "inherit"],
  }).toString();
}

const workdir = mkdtempSync(join(tmpdir(), "rewap-verify-"));
const consumerDir = join(workdir, "consumer");
mkdirSync(consumerDir, { recursive: true });

try {
  log("npm pack");
  const packOutput = run(
    "npm",
    ["pack", "--json", "--pack-destination", workdir],
    root,
  );
  const [{ filename, files }] = JSON.parse(packOutput);
  const tarballPath = join(workdir, filename);
  console.log(`  tarball: ${filename} (${files.length} files)`);

  log("checking the tarball only contains what it should");
  const allowedRoots = new Set([
    "dist",
    "templates",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "package.json",
  ]);
  const unexpected = files
    .map((f) => f.path)
    .filter((p) => !allowedRoots.has(p.split("/")[0]));
  if (unexpected.length > 0) {
    throw new Error(
      `tarball contains unexpected paths:\n  ${unexpected.join("\n  ")}`,
    );
  }

  log("installing the tarball into a scratch consumer project");
  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      { name: "rewap-verify-consumer", private: true, type: "module" },
      null,
      2,
    ),
  );
  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--omit=dev",
      tarballPath,
      "react@18",
      "react-dom@18",
    ],
    consumerDir,
  );

  log("importing every public entry point from the installed package");
  const pkgDir = join(consumerDir, "node_modules", "@nashiuso", "rewap");
  if (!existsSync(pkgDir)) {
    throw new Error(`expected ${pkgDir} to exist after install`);
  }

  const subpaths = Object.keys(manifest.exports).filter(
    (key) => key !== "./package.json" && !key.endsWith(".css"),
  );

  const checkScript = `
    import assert from "node:assert/strict";
    ${subpaths
      .map((subpath, i) => {
        const specifier =
          subpath === "."
            ? "@nashiuso/rewap"
            : `@nashiuso/rewap${subpath.slice(1)}`;
        return `const mod${i} = await import(${JSON.stringify(specifier)});\nassert.ok(mod${i} && typeof mod${i} === "object", ${JSON.stringify(specifier)} + " did not resolve to a module");`;
      })
      .join("\n")}
    console.log("  all ${subpaths.length} subpath(s) imported cleanly");
  `;
  writeFileSync(join(consumerDir, "check.mjs"), checkScript);
  console.log(run("node", ["check.mjs"], consumerDir).trim());

  log("checking CSS entry points resolve to real files");
  const cssSubpaths = Object.keys(manifest.exports).filter((key) =>
    key.endsWith(".css"),
  );
  for (const subpath of cssSubpaths) {
    const resolved = run(
      "node",
      [
        "-e",
        `console.log(require.resolve(${JSON.stringify(`@nashiuso/rewap${subpath.slice(1)}`)}))`,
      ],
      consumerDir,
    ).trim();
    if (!existsSync(resolved))
      throw new Error(`${subpath} resolved to a missing file: ${resolved}`);
    console.log(`  ${subpath} -> ${resolved.replace(consumerDir, ".")}`);
  }

  log("checking the CLI binary resolves and runs");
  const cliOutput = run(
    "npx",
    ["--no-install", "rewap", "version"],
    consumerDir,
  ).trim();
  console.log(`  rewap version -> ${cliOutput}`);

  console.log("\n✓ package verified from a clean install\n");
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
