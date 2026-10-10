/**
 * Template locations for the CLI.
 *
 * The templates are files in this repository (`templates/react`, `templates/astro`)
 * and they are shipped inside the published package. Nothing is downloaded: `rewap
 * init` copies what is already installed next to the CLI, which is why it works
 * offline and why the scaffold never changes under the user's feet.
 *
 * Both `src/cli/` and `dist/cli/` sit two levels below the package root, so the
 * same relative path resolves from the source tree and from the build.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type TemplateName = "react" | "astro";

export const templateNames: TemplateName[] = ["react", "astro"];

const here = dirname(fileURLToPath(import.meta.url));

/** Package root, from either `src/cli` or `dist/cli`. */
export const packageRoot = resolve(here, "..", "..");

export const templatesRoot = join(packageRoot, "templates");

export const templateDir = (name: TemplateName): string =>
  join(templatesRoot, name);

export const isTemplateName = (value: string): value is TemplateName =>
  (templateNames as string[]).includes(value);

export interface TemplateFile {
  /** Path relative to the template directory, using forward slashes. */
  path: string;
  contents: string;
  /** True for files npm would otherwise mangle (`_gitignore`, `_npmrc`). */
  renamed: boolean;
}

/** Every file in a template, read into memory. Dot-files are stored as `_name`. */
export const readTemplate = (name: TemplateName): TemplateFile[] => {
  const root = templateDir(name);
  if (!existsSync(root)) {
    throw new Error(
      `Template "${name}" is missing from ${templatesRoot}. ` +
        "If this is a published install, reinstall @nashiuso/rewap; if it is a checkout, run npm run build.",
    );
  }

  const files: TemplateFile[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!statSync(full).isFile()) continue;
      const path = relative(root, full).split(sep).join("/");
      const renamed = /(^|\/)_[^/]+$/.test(path);
      files.push({
        path: renamed ? path.replace(/(^|\/)_([^/]+)$/, "$1.$2") : path,
        contents: readFileSync(full, "utf8"),
        renamed,
      });
    }
  };

  walk(root);
  return files;
};

/** Substitutes `__NAME__` and friends. Keeps the templates runnable as-is. */
export const fillTemplate = (
  contents: string,
  values: Record<string, string>,
): string =>
  contents.replace(
    /__([A-Z_]+)__/g,
    (match, key: string) => values[key] ?? match,
  );

export const templatePackageName = (
  name: TemplateName,
  projectName: string,
): string => (name === "astro" ? `${projectName}-astro` : projectName);
