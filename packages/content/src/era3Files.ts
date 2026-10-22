// The Era 3 cards (2008 to 2025), one JSON file each in cards/era-3/. A new card file must be added here too (era3.test.ts checks).
// Each file is parsed with the card schema, so a card that breaks it fails at once, not only in content:check.
import { cardSchema } from "../schema/card.ts";
import c_e3_lio_001 from "../cards/era-3/e3-lio-001.json" with { type: "json" };
import c_e3_lio_002 from "../cards/era-3/e3-lio-002.json" with { type: "json" };
import c_e3_lio_003 from "../cards/era-3/e3-lio-003.json" with { type: "json" };
import c_e3_lio_006 from "../cards/era-3/e3-lio-006.json" with { type: "json" };
import c_e3_lio_009 from "../cards/era-3/e3-lio-009.json" with { type: "json" };
import c_e3_lio_010 from "../cards/era-3/e3-lio-010.json" with { type: "json" };
import c_e3_lio_011 from "../cards/era-3/e3-lio-011.json" with { type: "json" };
import c_e3_lio_013 from "../cards/era-3/e3-lio-013.json" with { type: "json" };
import c_e3_lio_014 from "../cards/era-3/e3-lio-014.json" with { type: "json" };
import c_e3_lio_015 from "../cards/era-3/e3-lio-015.json" with { type: "json" };
import c_e3_lio_016 from "../cards/era-3/e3-lio-016.json" with { type: "json" };
import c_e3_sae_001 from "../cards/era-3/e3-sae-001.json" with { type: "json" };
import c_e3_sae_002 from "../cards/era-3/e3-sae-002.json" with { type: "json" };
import c_e3_sae_003 from "../cards/era-3/e3-sae-003.json" with { type: "json" };
import c_e3_sae_004 from "../cards/era-3/e3-sae-004.json" with { type: "json" };
import c_e3_sae_005 from "../cards/era-3/e3-sae-005.json" with { type: "json" };
import c_e3_sae_007 from "../cards/era-3/e3-sae-007.json" with { type: "json" };
import c_e3_sae_008 from "../cards/era-3/e3-sae-008.json" with { type: "json" };
import c_e3_sae_009 from "../cards/era-3/e3-sae-009.json" with { type: "json" };
import c_e3_sae_010 from "../cards/era-3/e3-sae-010.json" with { type: "json" };
import c_e3_sae_011 from "../cards/era-3/e3-sae-011.json" with { type: "json" };
import c_e3_sae_012 from "../cards/era-3/e3-sae-012.json" with { type: "json" };
import c_e3_sae_013 from "../cards/era-3/e3-sae-013.json" with { type: "json" };
import c_e3_neu_001 from "../cards/era-3/e3-neu-001.json" with { type: "json" };
import c_e3_neu_002 from "../cards/era-3/e3-neu-002.json" with { type: "json" };
import c_e3_neu_003 from "../cards/era-3/e3-neu-003.json" with { type: "json" };
import c_e3_neu_004 from "../cards/era-3/e3-neu-004.json" with { type: "json" };
import c_e3_neu_005 from "../cards/era-3/e3-neu-005.json" with { type: "json" };
import c_e3_neu_007 from "../cards/era-3/e3-neu-007.json" with { type: "json" };
import c_e3_neu_008 from "../cards/era-3/e3-neu-008.json" with { type: "json" };
import c_e3_neu_009 from "../cards/era-3/e3-neu-009.json" with { type: "json" };

/** All 31 Era 3 cards: 11 LIO, 12 SAE and 8 neutral, in file order. */
export const ERA_3_CARDS = [
  c_e3_lio_001,
  c_e3_lio_002,
  c_e3_lio_003,
  c_e3_lio_006,
  c_e3_lio_009,
  c_e3_lio_010,
  c_e3_lio_011,
  c_e3_lio_013,
  c_e3_lio_014,
  c_e3_lio_015,
  c_e3_lio_016,
  c_e3_sae_001,
  c_e3_sae_002,
  c_e3_sae_003,
  c_e3_sae_004,
  c_e3_sae_005,
  c_e3_sae_007,
  c_e3_sae_008,
  c_e3_sae_009,
  c_e3_sae_010,
  c_e3_sae_011,
  c_e3_sae_012,
  c_e3_sae_013,
  c_e3_neu_001,
  c_e3_neu_002,
  c_e3_neu_003,
  c_e3_neu_004,
  c_e3_neu_005,
  c_e3_neu_007,
  c_e3_neu_008,
  c_e3_neu_009,
].map((file) => cardSchema.parse(file));
