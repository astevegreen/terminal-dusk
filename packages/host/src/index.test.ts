import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";
import { byCodeUnit } from "./test/order.ts";

describe("@terminal-dusk/host entry point", () => {
  it("exports the five host calls, the legal answers for one side (hostLegalAnswers), the online-create rule (createOnlineRefusal, isEntitlement, isPlatform, PLATFORMS), whether a player owns the Full Game (ownsFullGame), the tutorial runner and its game (startTutorial, stepTutorial, tutorialConfig) with its never-stuck rule (neverStuck), the bundled lessons for the app (TUTORIAL_LESSONS), and nothing else at run time (everything else it exports is a type)", () => {
    expect(Object.keys(entry).sort(byCodeUnit)).toEqual([
      "PLATFORMS",
      "TUTORIAL_LESSONS",
      "createOnlineRefusal",
      "hostArchive",
      "hostCreate",
      "hostDeadline",
      "hostLegalAnswers",
      "hostSubmit",
      "hostTimeout",
      "isEntitlement",
      "isPlatform",
      "neverStuck",
      "ownsFullGame",
      "startTutorial",
      "stepTutorial",
      "tutorialConfig",
    ]);
  });
});
