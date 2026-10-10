#!/usr/bin/env node
/**
 * Produces the `.d.cts` half of each dual entry point.
 *
 * `tsc -p tsconfig.build.json` already emitted a full `.d.ts` tree under
 * `dist/types` from a single compiler pass (see the comment in tsup.config.ts for
 * why that beats ten separate `rollup-plugin-dts` runs). The only thing missing
 * for `require()` consumers is a `.d.cts` next to every public entry point.
 *
 * The declaration files only re-export types from relative, extension-less
 * specifiers, so the ESM and CJS declarations are identical text — this just
 * duplicates each entry file under the `.d.cts` name TypeScript's `require`
 * resolution looks for, instead of re-running the compiler a second time.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const typesDir = join(root, "dist", "types");

const entryPoints = [
  "index",
  "react/index",
  "core/index",
  "math/index",
  "motion/index",
  "accessibility/index",
  "utilities/index",
  "providers/index",
  "charts/index",
  "widgets/index",
];

let copied = 0;
for (const entry of entryPoints) {
  const dts = join(typesDir, `${entry}.d.ts`);
  const dcts = join(typesDir, `${entry}.d.cts`);
  if (!existsSync(dts)) {
    console.error(`missing ${dts} — did the tsc pass run first?`);
    process.exitCode = 1;
    continue;
  }
  copyFileSync(dts, dcts);
  copied += 1;
}

console.log(
  `wrote ${copied} .d.cts file(s) alongside their .d.ts counterparts`,
);
