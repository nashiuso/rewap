/**
 * The CLI.
 *
 * These run the real code paths — `scaffold`, `doctor` and `info` — against a
 * temporary directory. Nothing is installed (`--no-install` is implied by
 * injecting a fake install runner), nothing is downloaded, and the temporary
 * directory is removed afterwards.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { doctor } from "../src/cli/doctor";
import { formatBytes, info } from "../src/cli/info";
import { scaffold, type ScaffoldOptions } from "../src/cli/scaffold";
import { readTemplate, templatesRoot } from "../src/cli/templates";

const version = "1.1.1";

let workspace: string;
let installs: string[];

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "rewap-cli-"));
  installs = [];
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

/** Everything a test may override; the helper supplies the rest. */
type ScaffoldOverrides = Pick<ScaffoldOptions, "template" | "install" | "force" | "cwd">;

const scaffoldInto = (name: string, options: ScaffoldOverrides = {}) =>
  scaffold({
    directory: join(workspace, name),
    version,
    install: true,
    runInstall: (directory, command) => {
      installs.push(`${directory} :: ${command}`);
      return 0;
    },
    ...options,
  });

describe("templates", () => {
  it("ships both templates in the repository", () => {
    for (const name of ["react", "astro"] as const) {
      const files = readTemplate(name);
      expect(files.length).toBeGreaterThan(4);
      expect(files.some((file) => file.path === "package.json")).toBe(true);
    }
    expect(existsSync(templatesRoot)).toBe(true);
  });

  it("stores dot-files under a name npm will keep, and reports the real one", () => {
    const files = readTemplate("react");
    const gitignore = files.find((file) => file.path === ".gitignore");
    expect(gitignore?.renamed).toBe(true);
  });
});

describe("rewap init", () => {
  it("writes a react project, replacing the placeholders", () => {
    const result = scaffoldInto("my-app");

    expect(result.written).toContain("package.json");
    expect(result.written).toContain("src/App.tsx");
    expect(result.written).toContain(".gitignore");
    expect(result.skipped).toEqual([]);
    expect(result.overwritten).toEqual([]);
    expect(result.installed).toBe(true);
    expect(installs).toHaveLength(1);

    const manifest = JSON.parse(readFileSync(join(result.directory, "package.json"), "utf8")) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(manifest.name).toBe("my-app");
    expect(manifest.dependencies["@nashiuso/rewap"]).toBe(version);

    const app = readFileSync(join(result.directory, "src/App.tsx"), "utf8");
    expect(app).toContain("my-app");
    expect(app).not.toContain("__NAME__");
  });

  it("writes an astro project when asked", () => {
    const result = scaffoldInto("site", { template: "astro" });
    expect(result.written).toContain("src/pages/index.astro");
    expect(result.written).toContain("src/components/Dashboard.tsx");

    const page = readFileSync(join(result.directory, "src/pages/index.astro"), "utf8");
    expect(page).toContain("client:visible");
    expect(page).toContain("client:load");

    const manifest = JSON.parse(readFileSync(join(result.directory, "package.json"), "utf8")) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(manifest.name).toBe("site-astro");
    expect(manifest.dependencies.astro).toMatch(/^\^4/);
  });

  it("does not install when --no-install is passed", () => {
    const result = scaffoldInto("offline-app", { install: false });
    expect(result.installed).toBe(false);
    expect(installs).toEqual([]);
    expect(result.notes.join(" ")).toMatch(/not installed/i);
  });

  it("refuses to write into a directory that already has files, and says which", () => {
    const directory = join(workspace, "existing");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "notes.md"), "hello", "utf8");

    expect(() => scaffold({ directory, version, install: false })).toThrow(/not empty/);
    expect(() => scaffold({ directory, version, install: false, force: true })).not.toThrow();
  });

  it("keeps files it did not write, and replaces the ones it does", () => {
    const directory = join(workspace, "partial");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), '{"name":"mine"}', "utf8");
    writeFileSync(join(directory, "notes.md"), "keep me", "utf8");

    const result = scaffold({ directory, version, install: false, force: true });
    expect(result.overwritten).toContain("package.json");
    expect(result.written).not.toContain("package.json");
    expect(result.untouched).toContain("notes.md");
    // `--force` replaces the files the template defines; everything else stays.
    expect(readFileSync(join(directory, "notes.md"), "utf8")).toBe("keep me");
    expect(JSON.parse(readFileSync(join(directory, "package.json"), "utf8"))).toMatchObject({
      name: "partial",
    });
  });

  it("reports an install failure instead of pretending it worked", () => {
    const result = scaffold({
      directory: join(workspace, "flaky"),
      version,
      install: true,
      runInstall: () => 1,
    });
    expect(result.installed).toBe(false);
    expect(result.notes.join(" ")).toMatch(/npm install/);
  });

  it("rejects an unknown template", () => {
    expect(() => scaffold({ directory: join(workspace, "x"), version, template: "svelte" as never })).toThrow(
      /Unknown template/,
    );
  });
});

describe("rewap doctor", () => {
  const project = (manifest: Record<string, unknown>, files: Record<string, string> = {}) => {
    const directory = join(
      workspace,
      `project-${Object.keys(files).length}-${Math.random().toString(36).slice(2, 7)}`,
    );
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify(manifest, null, 2), "utf8");
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(join(directory, path, ".."), { recursive: true });
      writeFileSync(join(directory, path), contents, "utf8");
    }
    return directory;
  };

  it("fails when there is no package.json", () => {
    const report = doctor(workspace, version);
    expect(report.failures).toBe(1);
    expect(report.checks.find((check) => check.id === "package")?.status).toBe("fail");
  });

  it("passes a project that has everything it needs", () => {
    const directory = project(
      { name: "app", dependencies: { "@nashiuso/rewap": "1.1.1", react: "18.3.1" } },
      { "src/main.tsx": 'import "@nashiuso/rewap/styles.css";\n' },
    );
    // A fake installed tree: the doctor reads versions from node_modules.
    for (const [name, pkgVersion] of [
      ["@nashiuso/rewap", "1.1.1"],
      ["react", "18.3.1"],
    ]) {
      mkdirSync(join(directory, "node_modules", name as string), { recursive: true });
      writeFileSync(
        join(directory, "node_modules", name as string, "package.json"),
        JSON.stringify({ version: pkgVersion }),
        "utf8",
      );
    }
    writeFileSync(join(directory, "package-lock.json"), "{}", "utf8");

    const report = doctor(directory, version);
    expect(report.failures).toBe(0);
    expect(report.warnings).toBe(0);
    expect(report.checks.find((check) => check.id === "stylesheet")?.status).toBe("ok");
    expect(report.checks.find((check) => check.id === "cdn")?.status).toBe("ok");
  });

  it("warns about a CDN reference and a missing stylesheet", () => {
    const directory = project(
      { name: "app", dependencies: { "@nashiuso/rewap": "1.1.1" } },
      { "src/main.tsx": 'import "https://cdn.jsdelivr.net/npm/@nashiuso/rewap/dist/index.js";\n' },
    );

    const report = doctor(directory, version);
    expect(report.checks.find((check) => check.id === "cdn")?.status).toBe("warn");
    expect(report.checks.find((check) => check.id === "stylesheet")?.status).toBe("warn");
  });

  it("warns when React is too old", () => {
    const directory = project({ name: "app", dependencies: { react: "17.0.2" } });
    mkdirSync(join(directory, "node_modules", "react"), { recursive: true });
    writeFileSync(
      join(directory, "node_modules", "react", "package.json"),
      JSON.stringify({ version: "17.0.2" }),
      "utf8",
    );

    expect(doctor(directory, version).checks.find((check) => check.id === "react")?.status).toBe("fail");
  });

  it("does not touch the network or the project it inspects", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("the doctor must not fetch anything");
    });
    const directory = project({ name: "app" }, { "src/main.tsx": "export {};\n" });
    const before = readFileSync(join(directory, "package.json"), "utf8");

    doctor(directory, version);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(readFileSync(join(directory, "package.json"), "utf8")).toBe(before);
    fetchSpy.mockRestore();
  });
});

describe("rewap info", () => {
  it("reports the package metadata from the manifest", () => {
    const report = info();
    expect(report.name).toBe("@nashiuso/rewap");
    expect(report.version).toBe("1.1.1");
    expect(report.license).toBe("MIT");
    expect(report.peer.react).toBe(">=18.0.0");
  });

  it("formats sizes for humans", () => {
    expect(formatBytes(512)).toBe("0.5 kB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("lists entry points from the build when it is present", () => {
    const report = info();
    if (!report.built) {
      expect(report.entries).toEqual([]);
      return;
    }
    expect(report.entries.map((entry) => entry.subpath)).toContain("./math");
    for (const entry of report.entries) {
      expect(entry.bytes).toBeGreaterThan(0);
    }
    expect(report.stylesheets.map((sheet) => sheet.subpath)).toContain("./styles.css");
  });
});
