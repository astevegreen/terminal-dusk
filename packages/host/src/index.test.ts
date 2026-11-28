import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";
import { byCodeUnit } from "./test/order.ts";

describe("@terminal-dusk/host entry point", () => {
  it("exports the five host calls, the legal answers for one side (hostLegalAnswers), the online-create rule (createOnlineRefusal, isEntitlement, isPlatform, PLATFORMS), the ranked-join rule (joinRankedRefusal), whether a player owns the Full Game (ownsFullGame), the Glicko-2 calculator and its constants (updateRating, displayRating, isGlicko2Rating, isProvisional, START_RATING, DEVIATION_FLOOR, DEVIATION_CEILING, TAU, PROVISIONAL_GAMES), the tutorial runner and its game (startTutorial, stepTutorial, tutorialConfig) with its never-stuck rule (neverStuck), the bundled lessons for the app (TUTORIAL_LESSONS), and nothing else at run time (everything else it exports is a type)", () => {
    expect(Object.keys(entry).sort(byCodeUnit)).toEqual([
      "DEVIATION_CEILING",
      "DEVIATION_FLOOR",
      "PLATFORMS",
      "PROVISIONAL_GAMES",
      "START_RATING",
      "TAU",
      "TUTORIAL_LESSONS",
      "createOnlineRefusal",
      "displayRating",
      "hostArchive",
      "hostCreate",
      "hostDeadline",
      "hostLegalAnswers",
      "hostSubmit",
      "hostTimeout",
      "isEntitlement",
      "isGlicko2Rating",
      "isPlatform",
      "isProvisional",
      "joinRankedRefusal",
      "neverStuck",
      "ownsFullGame",
      "startTutorial",
      "stepTutorial",
      "tutorialConfig",
      "updateRating",
    ]);
  });
});
