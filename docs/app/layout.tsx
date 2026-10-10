import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";

export const metadata = {
  title: {
    default: "rewap",
    template: "%s — rewap",
  },
  description:
    "Documentation for rewap, a React library for layouts whose items move.",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          search={{
            // No server on GitHub Pages: the index is a static file
            // (see app/api/search/route.ts) fetched and searched in the
            // browser. `basePath` isn't added automatically here.
            options: { type: "static", api: `${basePath}/api/search` },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
