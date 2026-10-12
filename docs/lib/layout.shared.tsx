import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const playgroundUrl = process.env.GH_PAGES
  ? `${basePath}/playground/`
  : "http://localhost:5173/";

/**
 * Options shared by the home and docs layouts: brand mark and navigation links.
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
        // This is a separate Vite app, not a Next.js route. Use a normal link
        // so Next does not prefetch it as an RSC page.
        type: "custom",
        children: (
          <a
            href={playgroundUrl}
            className="inline-flex items-center gap-1 p-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground"
          >
            Playground
          </a>
        ),
      },
      {
        text: "GitHub",
        url: "https://github.com/nashiuso/rewap",
        external: true,
      },
    ],
  };
}
