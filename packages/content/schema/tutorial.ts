// The tutorial lesson schema: what one lesson file in packages/content/tutorial/ must hold (#638;
// docs/design/tutorial.md; docs/architecture.md, Decision 4, "Tutorial"). A lesson coaches one real base game on the
// six-region map, the learner as LIO against the Easy AI, so it names no scenario, side or opponent: only the first
// cards drawn (`deckTop`, the engine's Setup.deckTop) and chapters of steps. The runner (host, #639) reads it.
// tutorial.types.test.ts checks the kind lists below against the engine's unions.
import * as z from "zod";
import { condition, era1Card, lineText, side } from "./tutorialLines.ts";

// Slots, conditions and the line check live in tutorialLines.ts; SAY_MAX is re-exported from here, as before.
export { SAY_MAX } from "./tutorialLines.ts";

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

/** The last turn a step may name: chapters fall inside Era 1, which is turns 1 to 3 (docs/design/tutorial.md). */
export const LAST_TUTORIAL_TURN = 3;

const name = z.string().min(1);
const turn = z.int().min(1).max(LAST_TUTORIAL_TURN);

/**
 * When a step starts or ends: the lesson's start, a Decision of that kind (for that side, on that turn), or an
 * event of that kind (by that side, on that turn).
 */
const eventTrigger = z.strictObject({
  event: z.enum(EVENT_KINDS),
  side: side.exactOptional(),
  turn: turn.exactOptional(),
});
const trigger = z.union([
  z.strictObject({ start: z.literal(true) }),
  z.strictObject({ decision: z.enum(DECISION_KINDS), side: side.exactOptional(), turn: turn.exactOptional() }),
  eventTrigger,
]);

/**
 * One answer the step allows. It limits only answers of its own `kind`; the fields it leaves out allow any value.
 * `as` is a PlayUse, `action` a PointsAction, and `event` where a rival card's event goes (rivalEventOrder).
 */
const matcher = z.strictObject({
  kind: z.enum(ANSWER_KINDS),
  card: era1Card.exactOptional(),
  as: z.enum(PLAY_USES).exactOptional(),
  action: z.enum(POINTS_ACTIONS).exactOptional(),
  country: name.exactOptional(),
  event: z.enum(["before", "after"]).exactOptional(),
});

/**
 * What a step or variant says: one approved line, or several shown together, each checked as a line (Decision
 * (architect), #701: chapter 7 shows its four lines at once).
 */
const says = z.union([lineText, z.array(lineText).min(1)]);

/**
 * Another full text for a step, used when every condition in `if` holds in the live game. A coach step's variant may
 * carry its own `allow`, used instead of the step's; a hint's may not.
 */
const variant = z.strictObject({
  if: z.array(condition).min(1),
  say: says,
  allow: z.array(matcher).min(1).exactOptional(),
});

/**
 * One coaching step. `style` "coach" (the default) may limit the answers with `allow`; a "hint" never does.
 * `until` is the trigger that moves on to the next step. The host shows the first variant whose conditions all hold,
 * else the step's own `say` and `allow`.
 */
const step = z
  .strictObject({
    when: trigger,
    say: says,
    style: z.enum(["coach", "hint"]).default("coach"),
    allow: z.array(matcher).min(1).exactOptional(),
    variants: z.array(variant).min(1).exactOptional(),
    until: trigger.exactOptional(),
  })
  .superRefine((s, ctx) => {
    if (s.style !== "hint") return;
    if (s.allow !== undefined) {
      ctx.addIssue({ code: "custom", path: ["allow"], message: "A hint step never limits answers: remove allow." });
    }
    s.variants?.forEach((v, i) => {
      if (v.allow === undefined) return;
      const message = "A hint step's variant never limits answers: remove allow.";
      ctx.addIssue({ code: "custom", path: ["variants", i, "allow"], message });
    });
  });

const chapter = z.strictObject({ id: name, title: name, steps: z.array(step).min(1) });

/**
 * A hint outside the chapter order: it shows when an event `when` matches arrives, only before chapter `before`
 * starts, and never limits answers (docs/design/tutorial.md, "If an ability fires before chapter 7").
 */
const aside = z.strictObject({ when: eventTrigger, before: name, say: lineText });

/** One lesson: its first cards drawn, in order, then its chapters, which run in order. */
export const lessonSchema = z
  .strictObject({
    id: name,
    title: name,
    placeholder: z.boolean(),
    deckTop: z.array(era1Card),
    chapters: z.array(chapter).min(1),
    asides: z.array(aside).min(1).exactOptional(),
  })
  .superRefine((lesson, ctx) => {
    const seen = new Set<string>();
    lesson.deckTop.forEach((card, i) => {
      if (seen.has(card))
        ctx.addIssue({ code: "custom", path: ["deckTop", i], message: `Card ${card} is listed twice.` });
      seen.add(card);
    });
    // Chapter ids are unique, so an aside's `before` names one chapter.
    const chapters = new Set<string>();
    lesson.chapters.forEach((c, i) => {
      if (chapters.has(c.id))
        ctx.addIssue({ code: "custom", path: ["chapters", i, "id"], message: `Chapter ${c.id} is listed twice.` });
      chapters.add(c.id);
    });
    lesson.asides?.forEach((a, i) => {
      if (chapters.has(a.before)) return;
      const message = `An aside shows before chapter ${a.before}, which the lesson does not have.`;
      ctx.addIssue({ code: "custom", path: ["asides", i, "before"], message });
    });
  });

export type Lesson = z.output<typeof lessonSchema>;
