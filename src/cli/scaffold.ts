/**
 * `rewap init` — writes a small project from a template that ships with the CLI.
 *
 * Two rules the scaffold keeps:
 *
 * 1. It never overwrites anything unless `--force` is passed, and it says which
 *    files it skipped when it does not.
 * 2. It never installs dependencies from anywhere but the registry the user's npm
 *    is already configured for, and `--no-install` skips even that. There is no
 *    step that fetches a template or a binary from a hard-coded URL.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  fillTemplate,
  readTemplate,
  templateNames,
  templatePackageName,
  type TemplateName,
} from "./templates";

export interface ScaffoldOptions {
  /** Directory to create, relative to `cwd`. Defaults to the current directory. */
  directory?: string;
  template?: TemplateName;
  /** Run the package manager after writing the files. Defaults to `true`. */
  install?: boolean;
  /** Write into a directory that is not empty. */
  force?: boolean;
  /** Version written into the generated `package.json` dependency. */
  version: string;
  cwd?: string;
  /** Injected for tests: returns the exit code of the install command. */
  runInstall?: (directory: string, command: string) => number;
}

export interface ScaffoldResult {
  directory: string;
  template: TemplateName;
  written: string[];
  /** Files the template provides that were already there, and were left alone. */
  skipped: string[];
  /** Files that were overwritten because `--force` was passed. */
  overwritten: string[];
  /** Files already in the directory that no template provides. */
  untouched: string[];
  installed: boolean;
  installCommand: string;
  notes: string[];
}

const packageManager = (): string => {
  const agent = process.env.npm_config_user_agent ?? "";
  if (agent.startsWith("pnpm")) return "pnpm";
  if (agent.startsWith("yarn")) return "yarn";
  return "npm";
};

export const scaffold = (options: ScaffoldOptions): ScaffoldResult => {
  const name = options.template ?? "react";
  const cwd = options.cwd ?? process.cwd();
  const directory = resolve(cwd, options.directory ?? ".");
  const install = options.install ?? true;
  const notes: string[] = [];

  if (!templateNames.includes(name)) {
    throw new Error(
      `Unknown template "${name}". Available: ${templateNames.join(", ")}.`,
    );
  }

  const exists = existsSync(directory);
  if (exists) {
    const entries = readdirSync(directory).filter((entry) => entry !== ".git");
    if (entries.length > 0 && !options.force) {
      throw new Error(
        `${directory} is not empty (${entries.slice(0, 4).join(", ")}${entries.length > 4 ? ", …" : ""}). ` +
          "Pass --force to write into it anyway.",
      );
    }
  } else {
    mkdirSync(directory, { recursive: true });
  }

  const projectName =
    directory === resolve(cwd)
      ? "rewap-app"
      : (directory.split(/[/\\]/).filter(Boolean).pop() ?? "rewap-app");
  const values: Record<string, string> = {
    NAME: projectName,
    PACKAGE_NAME: templatePackageName(name, projectName),
    REWAP_VERSION: options.version,
  };

  const template = readTemplate(name);
  const written: string[] = [];
  const skipped: string[] = [];
  const overwritten: string[] = [];

  for (const file of template) {
    const target = join(directory, file.path);
    const present = existsSync(target);
    if (present && !options.force) {
      skipped.push(file.path);
      continue;
    }
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, fillTemplate(file.contents, values), "utf8");
    if (present) overwritten.push(file.path);
    else written.push(file.path);
  }

  // Anything else already in the directory is none of the scaffold's business, but
  // saying so is friendlier than leaving the user to wonder.
  const provided = new Set(template.map((file) => file.path));
  const untouched = existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() || !provided.has(entry.name))
        .map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
        .filter((entry) => !["node_modules/", ".git/"].includes(entry))
    : [];

  const command = `${packageManager()} install`;
  let installed = false;

  if (install) {
    const run =
      options.runInstall ??
      ((where: string, cmd: string) => {
        const [program, ...args] = cmd.split(" ");
        return (
          spawnSync(program as string, args, {
            cwd: where,
            stdio: "inherit",
            shell: process.platform === "win32",
          }).status ?? 1
        );
      });
    installed = run(directory, command) === 0;
    if (!installed)
      notes.push(
        `The install step failed. Run \`${command}\` inside the project once you are online.`,
      );
  } else {
    notes.push(
      `Dependencies were not installed. Run \`${command}\` inside the project when you are ready.`,
    );
  }

  return {
    directory,
    template: name,
    written,
    skipped,
    overwritten,
    untouched,
    installed,
    installCommand: command,
    notes,
  };
};
