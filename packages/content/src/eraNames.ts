// The eras' shown names: each era's number and years, and the future cards' years (docs/design/eras.md).
import type { EraId } from "@terminal-dusk/engine";

export const ERA_NAMES: Readonly<Record<EraId, string>> = {
  "era-1": "Era 1 (1991–2001)",
  "era-2": "Era 2 (2001–2008)",
  "era-3": "Era 3 (2008–2025)",
  future: "Future cards (2025–2027)",
};
