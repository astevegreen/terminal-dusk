// What `pnpm boundaries` enforces, written as data. tools/gates/boundaries.mjs checks it and
// eslint.config.js repeats the engine part so mistakes show up as soon as a file is edited.
// Changing anything here changes hard rules 1-2 of CLAUDE.md or the package table in docs/architecture.md.

// The engine's public helpers: the only engine values app code may import ("`engine` types and public
// helpers" in the package table). Add a name here to allow it.
export const APP_ENGINE_VALUES = ["DECKS", "SIDES", "controller", "seedHash"];

// Which workspace packages each package may import (docs/architecture.md, Guardrails, "May import").
// "all" allows any import. "types" allows only type imports (`import type ...`) in code; test files may
// import values too, because every card's test plays the card with the real engine.
// { values: [...] } allows every type plus the listed values, again with test files free to import any.
export const MAY_IMPORT = {
  engine: {},
  content: { engine: "types" },
  host: { engine: "all", content: "all" },
  ai: { engine: "all", content: "all" },
  app: { engine: { values: APP_ENGINE_VALUES }, host: "all", ai: "all" },
  server: { engine: "all", content: "all", host: "all" },
  shells: { app: "all" },
};

// Only these packages may use the GameState type (hard rule 2).
export const GAME_STATE_PACKAGES = ["engine", "host"];

const NO_CLOCK = "the engine has no clock: the match host passes the time in";
const NO_RANDOM = "all randomness comes from the PRNG in packages/engine/src/rng.ts";
const NO_TIMERS = "the engine has no timers: every wait for a player is a pending Decision";
const NO_NETWORK = "the engine does no network I/O";
const NO_DOM = "the engine never touches the browser";
const NO_HOST = "the engine runs in the browser, the server and the AI worker alike, so it uses no host APIs";

// Globals the engine's own code may not use (hard rule 1), with the reason shown in the error.
export const ENGINE_FORBIDDEN_GLOBALS = {
  Date: NO_CLOCK,
  performance: NO_CLOCK,
  crypto: NO_RANDOM,
  setTimeout: NO_TIMERS,
  setInterval: NO_TIMERS,
  setImmediate: NO_TIMERS,
  clearTimeout: NO_TIMERS,
  clearInterval: NO_TIMERS,
  clearImmediate: NO_TIMERS,
  queueMicrotask: NO_TIMERS,
  requestAnimationFrame: NO_TIMERS,
  cancelAnimationFrame: NO_TIMERS,
  requestIdleCallback: NO_TIMERS,
  fetch: NO_NETWORK,
  XMLHttpRequest: NO_NETWORK,
  WebSocket: NO_NETWORK,
  EventSource: NO_NETWORK,
  navigator: NO_DOM,
  window: NO_DOM,
  document: NO_DOM,
  self: NO_DOM,
  location: NO_DOM,
  localStorage: NO_DOM,
  sessionStorage: NO_DOM,
  indexedDB: NO_DOM,
  globalThis: "it reaches every global, including the forbidden ones",
  process: NO_HOST,
  require: NO_HOST,
};

// Properties the engine may not use, as [object, property, reason].
export const ENGINE_FORBIDDEN_PROPERTIES = [["Math", "random", NO_RANDOM]];

// Engine test and config files may import these (and node: built-ins). Engine code may import nothing.
export const ENGINE_TOOLING_IMPORTS = ["vitest", "fast-check"];

// Test, benchmark and config files. They are exempt from the engine's global ban and may import
// test tools; every other rule still applies to them.
export const TOOLING_GLOBS = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.bench.*",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/*.config.*",
];
const TOOLING_FILE = /(^|\/)(test|tests|__tests__)\/|\.(test|spec|bench)\.[^/]+$|(^|\/)[^/]+\.config\.[^/]+$/;
export const isToolingFile = (relPath) => TOOLING_FILE.test(relPath);
