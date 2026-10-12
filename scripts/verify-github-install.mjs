#!/usr/bin/env node
/**
 * Verifies the Git dependency install path against the current working tree.
 * A temporary bare remote exercises npm's git installer without pushing to
 * GitHub or changing this repository's history.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function runCapture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
}

const work = mkdtempSync(join(tmpdir(), "rewap-github-install-"));
const snapshot = join(work, "snapshot");
const bareRepo = join(work, "rewap.git");
const consumer = join(work, "consumer");

try {
  console.log("\n→ snapshotting the current working tree");
  mkdirSync(snapshot, { recursive: true });
  const trackedAndNew = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root },
  )
    .toString()
    .split("\0")
    .filter(Boolean);

  for (const path of trackedAndNew) {
    const source = join(root, path);
    if (!existsSync(source)) continue;
    const target = join(snapshot, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, verbatimSymlinks: true });
  }

  run("git", ["init", "--quiet", "--initial-branch=main"], {
    cwd: snapshot,
  });
  run("git", ["config", "user.name", "Rewap install check"], {
    cwd: snapshot,
  });
  run("git", ["config", "user.email", "install-check@example.invalid"], {
    cwd: snapshot,
  });
  run("git", ["add", "-A"], { cwd: snapshot });
  run("git", ["commit", "--quiet", "-m", "working tree snapshot"], {
    cwd: snapshot,
  });
  const snapshotCommit = runCapture("git", ["rev-parse", "HEAD"], {
    cwd: snapshot,
  });

  mkdirSync(bareRepo, { recursive: true });
  run("git", ["init", "--bare", "--initial-branch=main", bareRepo]);
  run("git", ["push", bareRepo, `${snapshotCommit}:refs/heads/main`], {
    cwd: snapshot,
  });
  run("git", ["symbolic-ref", "HEAD", "refs/heads/main"], {
    cwd: bareRepo,
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
    "\n→ npm install git+file://<bare repo> (the same git dependency path)",
  );
  run("npm", ["install", `git+file://${bareRepo}`, "--no-audit", "--no-fund"], {
    cwd: consumer,
  });

  const packageDir = join(consumer, "node_modules", "@nashiuso", "rewap");
  const installedDist = join(packageDir, "dist");
  if (!existsSync(installedDist)) {
    throw new Error(
      `expected ${installedDist} to exist — the prepare lifecycle did not build dist/`,
    );
  }
  console.log("  prepare built dist/ in the installed git dependency");

  console.log("\n→ importing every public JavaScript entry point");
  const subpaths = Object.keys(manifest.exports).filter(
    (key) => key !== "./package.json" && !key.endsWith(".css"),
  );
  const specifiers = subpaths.map((path) =>
    path === "." ? "@nashiuso/rewap" : `@nashiuso/rewap${path.slice(1)}`,
  );
  const checkFile = join(consumer, "check-imports.mjs");
  writeFileSync(
    checkFile,
    specifiers
      .map((specifier) => `await import(${JSON.stringify(specifier)});`)
      .concat(`console.log("all ${specifiers.length} entry points imported");`)
      .join("\n"),
  );
  run("node", [checkFile], { cwd: consumer });

  console.log("\n→ resolving every CSS export from the consumer");
  const cssSubpaths = Object.keys(manifest.exports).filter((key) =>
    key.endsWith(".css"),
  );
  const resolveCssFile = join(consumer, "resolve-css.cjs");
  for (const subpath of cssSubpaths) {
    const specifier = `@nashiuso/rewap${subpath.slice(1)}`;
    writeFileSync(
      resolveCssFile,
      `console.log(require.resolve(${JSON.stringify(specifier)}));`,
    );
    const resolved = runCapture("node", [resolveCssFile], { cwd: consumer });
    console.log(`  ${subpath} -> ${resolved.replace(consumer + "/", "")}`);
  }

  console.log("\n→ checking declarations in a separate TypeScript consumer");
  run(
    "npm",
    [
      "install",
      "--no-save",
      "--no-audit",
      "--no-fund",
      "typescript",
      "@types/react",
      "@types/react-dom",
      "@types/node",
    ],
    { cwd: consumer },
  );
  const typesFile = join(consumer, "consumer-check.tsx");
  writeFileSync(
    typesFile,
    `import { Item, Layout, type LayoutMode } from "@nashiuso/rewap";\nconst mode: LayoutMode = "swap";\nexport const example = <Layout mode={mode}><Item id="one">One</Item></Layout>;\n`,
  );
  run(
    "node",
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--jsx",
      "react-jsx",
      "--target",
      "ES2020",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "consumer-check.tsx",
    ],
    { cwd: consumer },
  );

  console.log(
    "\n✓ Git installation, generated output, imports, CSS and declarations verified",
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
