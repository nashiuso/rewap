import { createFromSource } from "fumadocs-core/search/server";
import { source } from "../../../lib/source";

// Static export has no server, so the search index is written to a static
// file at build time and read entirely in the browser — see app/layout.tsx
// for the client side (`search={{ options: { type: "static" } }}`).
export const dynamic = "force-static";

export const { staticGET: GET } = createFromSource(source);
