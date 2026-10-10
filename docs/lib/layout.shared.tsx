import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Options shared between the docs layout and the (thin) home redirect, kept
 * in one place rather than repeated: the brand mark, the nav title, and the
 * two links a reader of these docs actually wants (source, playground).
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-semibold">
          <img
            src={`${basePath}/brand/buttons/mark.svg`}
            alt=""
            width={20}
            height={20}
            aria-hidden="true"
          />
          rewap
        </span>
      ),
    },
    links: [
      {
        // Only exists alongside this docs build on the deployed site
        // (scripts/site/build.mjs puts it at /playground/ next to the docs
        // root). A standalone `npm run docs:dev` has no playground running,
        // so it links to the source instead.
        text: "Playground",
        url: process.env.GH_PAGES
          ? `${basePath}/playground/`
          : "https://github.com/nashiuso/rewap/tree/main/examples/playground",
        external: !process.env.GH_PAGES,
      },
      {
        text: "GitHub",
        url: "https://github.com/nashiuso/rewap",
        external: true,
      },
    ],
  };
}
