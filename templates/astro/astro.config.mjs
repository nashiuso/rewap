import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// No adapter, no remote anything: `astro build` emits static HTML and the only
// JavaScript on the page is the islands below.
export default defineConfig({
  integrations: [react()],
});
