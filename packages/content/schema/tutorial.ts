// The tutorial lesson schema: what one lesson file in packages/content/tutorial/ must hold (#638;
// docs/design/tutorial.md; docs/architecture.md, Decision 4, "Tutorial"). A lesson coaches one real base game on the
// six-region map, the learner as LIO against the Easy AI, so it names no scenario, side or opponent: only the first
// cards drawn (`deckTop`, the engine's Setup.deckTop) and chapters of steps. The runner (host, #639) reads it.
// tutorial.types.test.ts checks the kind lists below against the engine's unions.
import * as z from "zod";
import { ERA_1_CARDS } from "../src/era1Files.ts";

/** Every Decision kind the engine has (the engine's DecisionKind). */
export const DECISION_KINDS = [
  "yesNo",
  "chooseCard",
  "playCardAs",
  "rivalEventOrder",
  "discardCards",
  "placeInfluence",
  "chooseAction",
  "realign",
  "extraPlay",
] as const;

/** Every event kind the engine emits (the engine's EventKind). */
export const EVENT_KINDS = [
  "abilityBonus",
  "abilityReady",
  "abilityRedraw",
  "cardDrawn",
  "cardDrawnHidden",
  "cardsDiscarded",
  "contingencyDeckReshuffled",
  "contingencyDrawn",
  "drawPileReshuffled",
  "eraStarted",
  "escalationChanged",
  "escalationCrisis",
  "handRevealed",
  "handRevealedHidden",
  "influencePlaced",
  "intervened",
  "marker",
  "modifierEnded",
  "modifierStarted",
  "playPassed",
  "pointsSpent",
  "realigned",
  "regionScored",
  "scoreChanged",
  "techRaceAttempted",
  "triggerEnded",
  "triggerFired",
  "triggerSet",
] as const;

/** Every answer kind (the engine's AnswerValue["kind"]). */
export const ANSWER_KINDS = [
  "yesNo",
  "chooseCard",
  "playCardAs",
  "rivalEventOrder",
  "discardCards",
  "placeInfluence",
  "chooseAction",
  "realign",
  "pass",
] as const;

/** The engine's PlayUse and PointsAction. */
export const PLAY_USES = ["event", "points"] as const;
export const POINTS_ACTIONS = ["place", "intervene", "realign", "techRace", "pass"] as const;

/** The longest coaching text a step may say, in characters: a few short sentences for the coaching panel. */
export const SAY_MAX = 700;
/** The last turn a step may name: chapters fall inside Era 1, which is turns 1 to 3 (docs/design/tutorial.md). */
export const LAST_TUTORIAL_TURN = 3;

const ERA_1_IDS: ReadonlySet<string> = new Set(ERA_1_CARDS.map((card) => card.id));
const name = z.string().min(1);
const era1Card = name.refine((id) => ERA_1_IDS.has(id), { message: "Only Era 1 cards can be named in a lesson." });
const side = z.enum(["lio", "sae"]);
const turn = z.int().min(1).max(LAST_TUTORIAL_TURN);

/**
 * When a step starts or ends: the lesson's start, a Decision of that kind (for that side, on that turn), or an
 * event of that kind (by that side, on that turn).
 */
const trigger = z.union([
  z.strictObject({ start: z.literal(true) }),
  z.strictObject({ decision: z.enum(DECISION_KINDS), side: side.exactOptional(), turn: turn.exactOptional() }),
  z.strictObject({ event: z.enum(EVENT_KINDS), side: side.exactOptional(), turn: turn.exactOptional() }),
]);

/**
 * One answer the step allows. It limits only answers of its own `kind`; the fields it leaves out allow any value.
 * `as` is a PlayUse and `action` a PointsAction.
 */
const matcher = z.strictObject({
  kind: z.enum(ANSWER_KINDS),
  card: era1Card.exactOptional(),
  as: z.enum(PLAY_USES).exactOptional(),
  action: z.enum(POINTS_ACTIONS).exactOptional(),
  country: name.exactOptional(),
});

/**
 * One coaching step. `style` "coach" (the default) may limit the answers with `allow`; a "hint" never does.
 * `until` is the trigger that moves on to the next step.
 */
const step = z
  .strictObject({
    when: trigger,
    say: z.string().min(1).max(SAY_MAX),
    style: z.enum(["coach", "hint"]).default("coach"),
    allow: z.array(matcher).min(1).exactOptional(),
    until: trigger.exactOptional(),
  })
  .superRefine((s, ctx) => {
    if (s.style === "hint" && s.allow !== undefined) {
      ctx.addIssue({ code: "custom", path: ["allow"], message: "A hint step never limits answers: remove allow." });
    }
  });

const chapter = z.strictObject({ id: name, title: name, steps: z.array(step).min(1) });

/** One lesson: its first cards drawn, in order, then its chapters, which run in order. */
export const lessonSchema = z
  .strictObject({
    id: name,
    title: name,
    placeholder: z.boolean(),
    deckTop: z.array(era1Card),
    chapters: z.array(chapter).min(1),
  })
  .superRefine((lesson, ctx) => {
    const seen = new Set<string>();
    lesson.deckTop.forEach((card, i) => {
      if (seen.has(card))
        ctx.addIssue({ code: "custom", path: ["deckTop", i], message: `Card ${card} is listed twice.` });
      seen.add(card);
    });
  });

export type Lesson = z.output<typeof lessonSchema>;
