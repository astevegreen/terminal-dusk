// The optional future cards (2025 to 2027), one JSON file each in cards/future/. A new card file must be added here too (future.test.ts checks).
// Each file is parsed with the card schema, so a card that breaks it fails at once, not only in content:check.
import { cardSchema } from "../schema/card.ts";
import c_ef_lio_001 from "../cards/future/ef-lio-001.json" with { type: "json" };
import c_ef_lio_002 from "../cards/future/ef-lio-002.json" with { type: "json" };
import c_ef_sae_001 from "../cards/future/ef-sae-001.json" with { type: "json" };
import c_ef_sae_002 from "../cards/future/ef-sae-002.json" with { type: "json" };
import c_ef_neu_001 from "../cards/future/ef-neu-001.json" with { type: "json" };
import c_ef_neu_002 from "../cards/future/ef-neu-002.json" with { type: "json" };

/** The 6 optional future cards (2025 to 2027): 2 LIO, 2 SAE and 2 neutral. Roles only, no named people. */
export const FUTURE_CARDS = [c_ef_lio_001, c_ef_lio_002, c_ef_sae_001, c_ef_sae_002, c_ef_neu_001, c_ef_neu_002].map(
  (file) => cardSchema.parse(file),
);
