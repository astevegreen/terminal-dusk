// Vite settings for `pnpm dev`, `vite build` and the app's Vitest run.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
