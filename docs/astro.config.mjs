import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";

const docsRoot = dirname(fileURLToPath(import.meta.url));

/**
 * The site only ever deploys to one place: the project Pages URL. `base` is
 * therefore hardcoded rather than switched on an environment variable, so a
 * local `npm run dev`, a local `npm run build` and the CI build all produce
 * the same absolute URLs. A build that is only correct in CI is a build that
 * gets debugged in production.
 *
 * `scripts/site/preview.mjs` serves the assembled output under the same
 * prefix so `/rewap/` links resolve while previewing.
 */
export default defineConfig({
  root: docsRoot,
  site: "https://nashiuso.github.io",
  base: "/rewap",
  outDir: "./dist",
  // GitHub Pages serves files, not routes: every URL has to be a real
  // directory with an index.html in it.
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [
    starlight({
      title: "rewap",
      description:
        "Documentation for rewap, a React library for layouts whose items move.",
      logo: {
        src: "./src/assets/brand/buttons/mark.svg",
        alt: "rewap",
      },
      favicon: "/brand/buttons/mark.svg",
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/nashiuso/rewap",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/nashiuso/rewap/edit/main/docs/",
      },
      // Pagefind runs at the end of `astro build` and searches entirely in the
      // browser from a static index. There is no search server to run.
      pagefind: true,
      sidebar: [
        {
          label: "Start here",
          items: ["index", "installation", "quick-start"],
        },
        {
          label: "Guides",
          items: [
            "api-and-layout-modes",
            "motion-and-customization",
            "accessibility-and-ssr",
            "known-limitations",
          ],
        },
        {
          label: "Playground",
          items: ["playground"],
        },
      ],
    }),
    react(),
  ],
});
