#!/usr/bin/env node
/**
 * Proves the "install straight from git, build on install" story actually
 * works, without needing to push anywhere. It:
 *
 *   1. Makes a throwaway bare git repo from the current commit (HEAD, not
 *      the working tree — same as what a real `npm install github:...`
 *      would fetch).
 *   2. `npm install`s it into a scratch consumer project the exact same way
 *      npm handles any git dependency (`git+file://` is resolved by npm's
 *      git-dependency code path, not its local-path/`file:` code path).
 *   3. Imports the documented entry points and resolves the CSS exports,
 *      from the *consumer's* node_modules — not from this repo's own dist/,
 *      which would prove nothing about a real install.
 *
 * Doesn't touch the real GitHub remote and doesn't require network access
 * beyond what's already local.
 */
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function runCapture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
}

const work = mkdtempSync(join(tmpdir(), "rewap-github-install-"));
const bareRepo = join(work, "rewap.git");
const consumer = join(work, "consumer");

try {
  const headCommit = runCapture("git", ["rev-parse", "HEAD"], { cwd: root });
  console.log(`\n→ packaging HEAD (${headCommit.slice(0, 8)}) as a bare repo`);
  mkdirSync(bareRepo, { recursive: true });
  run("git", ["init", "--bare", bareRepo]);
  run("git", ["push", bareRepo, `${headCommit}:refs/heads/main`], {
    cwd: root,
  });

  console.log("\n→ creating a scratch consumer project");
  mkdirSync(consumer, { recursive: true });
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify(
      {
        name: "rewap-github-install-check",
        private: true,
        version: "0.0.0",
        type: "module",
      },
      null,
      2,
    ),
  );

  console.log(
    "\n→ npm install git+file://<bare repo> (same code path as github:nashiuso/rewap)",
  );
  run(
    "npm",
    ["install", `git+file://${bareRepo}`, "--no-audit", "--no-fund"],
    { cwd: consumer },
  );

  const installedDist = join(
    consumer,
    "node_modules",
    "@nashiuso",
    "rewap",
    "dist",
  );
  if (!existsSync(installedDist)) {
    throw new Error(
      `expected ${installedDist} to exist — the "prepare" script did not build dist/ on install`,
    );
  }
  console.log(`  dist/ was built on install: ${installedDist}`);

  console.log("\n→ importing documented entry points from the installed package");
  const subpaths = [
    ".",
    "./react",
    "./core",
    "./math",
    "./motion",
    "./accessibility",
    "./utilities",
    "./providers",
  ];
  const checkFile = join(consumer, "check-imports.mjs");
  writeFileSync(
    checkFile,
    subpaths
      .map((p) => `await import(${JSON.stringify(`@nashiuso/rewap${p === "." ? "" : p}`)});`)
      .join("\n") + `\nconsole.log("all ${subpaths.length} subpath(s) imported cleanly");\n`,
  );
  run("node", [checkFile], { cwd: consumer });

  console.log("\n→ resolving CSS entry points");
  const resolveCssFile = join(consumer, "resolve-css.cjs");
  for (const css of ["styles.css", "tokens.css", "charts.css", "widgets.css"]) {
    writeFileSync(
      resolveCssFile,
      `console.log(require.resolve(${JSON.stringify(`@nashiuso/rewap/${css}`)}));`,
    );
    const resolved = runCapture("node", [resolveCssFile], { cwd: consumer });
    console.log(`  ./${css} -> ${resolved.replace(consumer + "/", "")}`);
  }

  console.log("\n✓ installing @nashiuso/rewap straight from git works end to end");
} finally {
  rmSync(work, { recursive: true, force: true });
}
