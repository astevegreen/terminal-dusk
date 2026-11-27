// Vite settings for `pnpm dev`, `vite build` and the app's Vitest run.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import manifest from "./public/sounds/manifest.json" with { type: "json" };

/**
 * The sound manifest as the module `virtual:sound-manifest`, built into the app. It lives in public/ beside the files
 * it lists, and Vite does not let source import from there; this file may. The type is declared in
 * src/soundManifest.d.ts.
 */
const soundManifest: Plugin = {
  name: "sound-manifest",
  resolveId: (id) => (id === "virtual:sound-manifest" ? "\0virtual:sound-manifest" : null),
  load: (id) => (id === "\0virtual:sound-manifest" ? `export default ${JSON.stringify(manifest)};` : null),
};

export default defineConfig({
  plugins: [react(), soundManifest],
  // Two pages: the app, and the web checkout's pay page (#685), which the server's checkout address points at.
  build: {
    rolldownOptions: {
      input: { main: `${import.meta.dirname}/index.html`, pay: `${import.meta.dirname}/pay/index.html` },
    },
  },
});
