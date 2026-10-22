// The Era 2 cards (2001 to 2008), one JSON file each in cards/era-2/. A new card file must be added here too (era2.test.ts checks).
// Each file is parsed with the card schema, so a card that breaks it fails at once, not only in content:check.
import { cardSchema } from "../schema/card.ts";
import c_e2_lio_002 from "../cards/era-2/e2-lio-002.json" with { type: "json" };
import c_e2_lio_004 from "../cards/era-2/e2-lio-004.json" with { type: "json" };
import c_e2_lio_006 from "../cards/era-2/e2-lio-006.json" with { type: "json" };
import c_e2_lio_007 from "../cards/era-2/e2-lio-007.json" with { type: "json" };
import c_e2_lio_008 from "../cards/era-2/e2-lio-008.json" with { type: "json" };
import c_e2_lio_009 from "../cards/era-2/e2-lio-009.json" with { type: "json" };
import c_e2_lio_010 from "../cards/era-2/e2-lio-010.json" with { type: "json" };
import c_e2_lio_011 from "../cards/era-2/e2-lio-011.json" with { type: "json" };
import c_e2_lio_012 from "../cards/era-2/e2-lio-012.json" with { type: "json" };
import c_e2_lio_013 from "../cards/era-2/e2-lio-013.json" with { type: "json" };
import c_e2_lio_014 from "../cards/era-2/e2-lio-014.json" with { type: "json" };
import c_e2_sae_001 from "../cards/era-2/e2-sae-001.json" with { type: "json" };
import c_e2_sae_002 from "../cards/era-2/e2-sae-002.json" with { type: "json" };
import c_e2_sae_003 from "../cards/era-2/e2-sae-003.json" with { type: "json" };
import c_e2_sae_004 from "../cards/era-2/e2-sae-004.json" with { type: "json" };
import c_e2_sae_005 from "../cards/era-2/e2-sae-005.json" with { type: "json" };
import c_e2_sae_007 from "../cards/era-2/e2-sae-007.json" with { type: "json" };
import c_e2_sae_008 from "../cards/era-2/e2-sae-008.json" with { type: "json" };
import c_e2_sae_010 from "../cards/era-2/e2-sae-010.json" with { type: "json" };
import c_e2_sae_011 from "../cards/era-2/e2-sae-011.json" with { type: "json" };
import c_e2_sae_012 from "../cards/era-2/e2-sae-012.json" with { type: "json" };
import c_e2_sae_013 from "../cards/era-2/e2-sae-013.json" with { type: "json" };
import c_e2_neu_001 from "../cards/era-2/e2-neu-001.json" with { type: "json" };
import c_e2_neu_002 from "../cards/era-2/e2-neu-002.json" with { type: "json" };
import c_e2_neu_003 from "../cards/era-2/e2-neu-003.json" with { type: "json" };
import c_e2_neu_004 from "../cards/era-2/e2-neu-004.json" with { type: "json" };
import c_e2_neu_005 from "../cards/era-2/e2-neu-005.json" with { type: "json" };
import c_e2_neu_006 from "../cards/era-2/e2-neu-006.json" with { type: "json" };
import c_e2_neu_007 from "../cards/era-2/e2-neu-007.json" with { type: "json" };
import c_e2_neu_008 from "../cards/era-2/e2-neu-008.json" with { type: "json" };

/** All 30 Era 2 cards: 11 LIO, 11 SAE and 8 neutral, in file order. */
export const ERA_2_CARDS = [
  c_e2_lio_002,
  c_e2_lio_004,
  c_e2_lio_006,
  c_e2_lio_007,
  c_e2_lio_008,
  c_e2_lio_009,
  c_e2_lio_010,
  c_e2_lio_011,
  c_e2_lio_012,
  c_e2_lio_013,
  c_e2_lio_014,
  c_e2_sae_001,
  c_e2_sae_002,
  c_e2_sae_003,
  c_e2_sae_004,
  c_e2_sae_005,
  c_e2_sae_007,
  c_e2_sae_008,
  c_e2_sae_010,
  c_e2_sae_011,
  c_e2_sae_012,
  c_e2_sae_013,
  c_e2_neu_001,
  c_e2_neu_002,
  c_e2_neu_003,
  c_e2_neu_004,
  c_e2_neu_005,
  c_e2_neu_006,
  c_e2_neu_007,
  c_e2_neu_008,
].map((file) => cardSchema.parse(file));
