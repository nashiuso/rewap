import Link from "next/link";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const playgroundHref = process.env.GH_PAGES
  ? `${basePath}/playground/`
  : "https://github.com/nashiuso/rewap/tree/main/examples/playground";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <img
        src={`${basePath}/brand/buttons/logo.svg`}
        alt="rewap"
        width={56}
        height={56}
      />
      <h1 className="text-2xl font-semibold tracking-tight">rewap</h1>
      <p className="max-w-md text-fd-muted-foreground">
        A React library for layouts whose items move: swapping, reordering,
        grids, dashboards, boards.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/docs/introduction"
          className="rounded-md border border-fd-border bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
        >
          Read the docs
        </Link>
        <a
          href={playgroundHref}
          target={process.env.GH_PAGES ? undefined : "_blank"}
          rel="noreferrer"
          className="rounded-md border border-fd-border px-4 py-2 text-sm font-medium"
        >
          Open the playground
        </a>
        <a
          href="https://github.com/nashiuso/rewap"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-fd-border px-4 py-2 text-sm font-medium"
        >
          GitHub
        </a>
      </div>
    </main>
  );
}
