import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

// One collection, one loader. Starlight builds the sidebar, the previous/next
// links and the Pagefind index from it.
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
