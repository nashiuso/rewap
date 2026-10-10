/**
 * The `rewap` command.
 *
 * Three commands, no dependencies, nothing fetched:
 *
 * ```
 * rewap init [dir] [--template react|astro] [--no-install] [--force]
 * rewap doctor [dir]
 * rewap info
 * rewap help
 * ```
 *
 * The CLI shares a repository with the library but not a runtime: it is a Node
 * program, it is never imported by a browser bundle, and it lives in its own
 * `dist/cli` build. That separation is deliberate — a package that drags a
 * filesystem API into the browser build because the CLI lives next to it has
 * already lost.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { doctor } from "./doctor";
import { formatBytes, info } from "./info";
import { scaffold } from "./scaffold";
import {
  isTemplateName,
  packageRoot,
  templateNames,
  type TemplateName,
} from "./templates";

const version = (): string => {
  try {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as {
      version?: string;
    };
    return manifest.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
};

const help = (): string => `rewap ${version()} — the @nashiuso/rewap CLI

Usage
  rewap init [dir]            scaffold a project (default template: react)
  rewap doctor [dir]          check a project against the library's assumptions
  rewap info                  print what is installed, and its entry points
  rewap help                  this text

Options for init
  --template <react|astro>    which starter to write (available: ${templateNames.join(", ")})
  --no-install                write the files only; do not run the package manager
  --force                     write into a directory that already has files, replacing any
                              file the template also defines

Nothing this command does reaches the network. Templates ship with the package.`;

interface Parsed {
  command: string;
  positionals: string[];
  flags: Map<string, string | boolean>;
}

const parse = (argv: string[]): Parsed => {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] as string;
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }
    const name = token.replace(/^--?/, "");
    const [key, inline] = name.split("=");
    if (inline !== undefined) {
      flags.set(key as string, inline);
      continue;
    }
    const next = argv[index + 1];
    if (
      ["template", "t"].includes(key as string) &&
      next &&
      !next.startsWith("-")
    ) {
      flags.set("template", next);
      index += 1;
      continue;
    }
    flags.set(key as string, true);
  }

  return { command: positionals.shift() ?? "help", positionals, flags };
};

const print = (line = ""): void => {
  process.stdout.write(`${line}\n`);
};

const runInit = (parsed: Parsed): number => {
  const templateFlag = parsed.flags.get("template");
  const template = typeof templateFlag === "string" ? templateFlag : "react";
  if (!isTemplateName(template)) {
    process.stderr.write(
      `Unknown template "${template}". Available: ${templateNames.join(", ")}.\n`,
    );
    return 1;
  }

  const directory = parsed.positionals[0];
  const install =
    parsed.flags.get("install") !== false && !parsed.flags.has("no-install");

  try {
    const result = scaffold({
      ...(directory ? { directory } : {}),
      template: template as TemplateName,
      install,
      force: parsed.flags.has("force") || parsed.flags.has("f"),
      version: version(),
    });

    print(`rewap init — ${result.template} template`);
    print(`  ${result.written.length} file(s) written to ${result.directory}`);
    for (const file of result.written) print(`    + ${file}`);
    for (const file of result.overwritten) print(`    ! ${file} (replaced)`);
    for (const file of result.skipped)
      print(`    = ${file} (kept, already there)`);
    if (result.untouched.length > 0)
      print(`  left alone: ${result.untouched.join(", ")}`);
    for (const note of result.notes) print(`  ${note}`);
    if (result.installed)
      print(`  dependencies installed with \`${result.installCommand}\``);
    print();
    print("Next:");
    print(`  cd ${result.directory}`);
    if (!result.installed) print(`  ${result.installCommand}`);
    print("  npm run dev");
    print();
    print(
      "Drag something. Then run `npx rewap doctor` if the layout looks wrong.",
    );
    return 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
};

const symbols: Record<string, string> = {
  ok: "ok  ",
  warn: "warn",
  fail: "FAIL",
  skip: "--  ",
};

const runDoctor = (parsed: Parsed): number => {
  const report = doctor(parsed.positionals[0] ?? process.cwd(), version());

  print(`rewap doctor — ${report.directory}`);
  print();
  for (const check of report.checks) {
    print(
      `  ${symbols[check.status] ?? check.status}  ${check.title}: ${check.detail}`,
    );
    if (check.hint && check.status !== "ok") print(`         ${check.hint}`);
  }
  print();
  print(
    report.failures > 0
      ? `${report.failures} check(s) failed, ${report.warnings} warning(s).`
      : report.warnings > 0
        ? `No failures, ${report.warnings} warning(s).`
        : "Everything checks out.",
  );
  return report.failures > 0 ? 1 : 0;
};

const runInfo = (): number => {
  const report = info();
  print(`${report.name} ${report.version} · ${report.license}`);
  print(`${report.homepage}`);
  print(
    `node ${report.node} · peer ${Object.entries(report.peer)
      .map(([name, range]) => `${name} ${range}`)
      .join(", ")}`,
  );
  print();

  if (!report.built) {
    print(
      "The build is not present in this checkout. Run `npm run build` in the package.",
    );
    return 0;
  }

  print("Entry points (raw file size; gzip for JavaScript):");
  for (const entry of report.entries) {
    const size =
      entry.gzipBytes === null
        ? formatBytes(entry.bytes)
        : `${formatBytes(entry.bytes)} raw · ${formatBytes(entry.gzipBytes)} gzip`;
    print(`  ${entry.subpath.padEnd(26)} ${size}`);
  }
  print();
  print("Stylesheets:");
  for (const sheet of report.stylesheets)
    print(`  ${sheet.subpath.padEnd(26)} ${formatBytes(sheet.bytes)}`);
  print();
  print(
    "The root entry stays small on purpose. Import a subpath only when you use it.",
  );
  return 0;
};

export const main = (argv: string[]): number => {
  const parsed = parse(argv);

  switch (parsed.command) {
    case "init":
    case "create":
      return runInit(parsed);
    case "doctor":
    case "check":
      return runDoctor(parsed);
    case "info":
      return runInfo();
    case "version":
      print(version());
      return 0;
    default:
      print(help());
      return 0;
  }
};

process.exitCode = main(process.argv.slice(2));
