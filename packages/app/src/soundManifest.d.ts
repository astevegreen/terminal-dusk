// public/sounds/manifest.json, as vite.config.ts makes it importable. `pnpm content:check` holds it to its schema.
declare module "virtual:sound-manifest" {
  const manifest: import("./platform/audio.ts").SoundFiles;
  export default manifest;
}
