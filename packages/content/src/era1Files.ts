// The Era 1 cards (1991 to 2001), one JSON file each in cards/era-1/. A new card file must be added here too (era1.test.ts checks).
// Each file is parsed with the card schema, so a card that breaks it fails at once, not only in content:check.
import { cardSchema } from "../schema/card.ts";
import c_e1_lio_001 from "../cards/era-1/e1-lio-001.json" with { type: "json" };
import c_e1_lio_002 from "../cards/era-1/e1-lio-002.json" with { type: "json" };
import c_e1_lio_003 from "../cards/era-1/e1-lio-003.json" with { type: "json" };
import c_e1_lio_004 from "../cards/era-1/e1-lio-004.json" with { type: "json" };
import c_e1_lio_005 from "../cards/era-1/e1-lio-005.json" with { type: "json" };
import c_e1_lio_006 from "../cards/era-1/e1-lio-006.json" with { type: "json" };
import c_e1_lio_007 from "../cards/era-1/e1-lio-007.json" with { type: "json" };
import c_e1_lio_008 from "../cards/era-1/e1-lio-008.json" with { type: "json" };
import c_e1_lio_009 from "../cards/era-1/e1-lio-009.json" with { type: "json" };
import c_e1_lio_010 from "../cards/era-1/e1-lio-010.json" with { type: "json" };
import c_e1_lio_011 from "../cards/era-1/e1-lio-011.json" with { type: "json" };
import c_e1_lio_012 from "../cards/era-1/e1-lio-012.json" with { type: "json" };
import c_e1_lio_013 from "../cards/era-1/e1-lio-013.json" with { type: "json" };
import c_e1_sae_001 from "../cards/era-1/e1-sae-001.json" with { type: "json" };
import c_e1_sae_002 from "../cards/era-1/e1-sae-002.json" with { type: "json" };
import c_e1_sae_003 from "../cards/era-1/e1-sae-003.json" with { type: "json" };
import c_e1_sae_004 from "../cards/era-1/e1-sae-004.json" with { type: "json" };
import c_e1_sae_005 from "../cards/era-1/e1-sae-005.json" with { type: "json" };
import c_e1_sae_006 from "../cards/era-1/e1-sae-006.json" with { type: "json" };
import c_e1_sae_007 from "../cards/era-1/e1-sae-007.json" with { type: "json" };
import c_e1_sae_008 from "../cards/era-1/e1-sae-008.json" with { type: "json" };
import c_e1_sae_009 from "../cards/era-1/e1-sae-009.json" with { type: "json" };
import c_e1_sae_010 from "../cards/era-1/e1-sae-010.json" with { type: "json" };
import c_e1_sae_011 from "../cards/era-1/e1-sae-011.json" with { type: "json" };
import c_e1_sae_012 from "../cards/era-1/e1-sae-012.json" with { type: "json" };
import c_e1_sae_013 from "../cards/era-1/e1-sae-013.json" with { type: "json" };
import c_e1_neu_001 from "../cards/era-1/e1-neu-001.json" with { type: "json" };
import c_e1_neu_002 from "../cards/era-1/e1-neu-002.json" with { type: "json" };
import c_e1_neu_003 from "../cards/era-1/e1-neu-003.json" with { type: "json" };
import c_e1_neu_004 from "../cards/era-1/e1-neu-004.json" with { type: "json" };
import c_e1_neu_005 from "../cards/era-1/e1-neu-005.json" with { type: "json" };
import c_e1_neu_006 from "../cards/era-1/e1-neu-006.json" with { type: "json" };
import c_e1_neu_007 from "../cards/era-1/e1-neu-007.json" with { type: "json" };
import c_e1_neu_008 from "../cards/era-1/e1-neu-008.json" with { type: "json" };

/** One Era 1 card file, as the card schema reads it. */
export type Card = ReturnType<typeof cardSchema.parse>;

/** All 34 Era 1 cards: 13 LIO, 13 SAE and 8 neutral, in file order. */
export const ERA_1_CARDS: readonly Card[] = [
  c_e1_lio_001,
  c_e1_lio_002,
  c_e1_lio_003,
  c_e1_lio_004,
  c_e1_lio_005,
  c_e1_lio_006,
  c_e1_lio_007,
  c_e1_lio_008,
  c_e1_lio_009,
  c_e1_lio_010,
  c_e1_lio_011,
  c_e1_lio_012,
  c_e1_lio_013,
  c_e1_sae_001,
  c_e1_sae_002,
  c_e1_sae_003,
  c_e1_sae_004,
  c_e1_sae_005,
  c_e1_sae_006,
  c_e1_sae_007,
  c_e1_sae_008,
  c_e1_sae_009,
  c_e1_sae_010,
  c_e1_sae_011,
  c_e1_sae_012,
  c_e1_sae_013,
  c_e1_neu_001,
  c_e1_neu_002,
  c_e1_neu_003,
  c_e1_neu_004,
  c_e1_neu_005,
  c_e1_neu_006,
  c_e1_neu_007,
  c_e1_neu_008,
].map((file) => cardSchema.parse(file));
