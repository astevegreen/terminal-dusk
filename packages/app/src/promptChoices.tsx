// How a prompt draws its choices (decisionPrompts.tsx), and where (L6, #486; docs/design/screen-layout.md). A
// choice that belongs to cards in the hand, such as playing a card or discarding it, can go on the lifted card in
// the hand strip instead of in the decision's own region: the prompt is drawn once per place, and each place shows
// only its own choices. Left out, a prompt draws every choice in one place, as before L6. A choice that names a
// country (L7, #487) is tapped on the map instead: the banner leaves it out and says to tap a glowing country.
import type { AnswerValue, CardId, CountryId, Decision } from "@terminal-dusk/engine";

/**
 * Where a prompt is drawn: "banner" is the decision's own region (its question, and the choices that belong to no
 * card in the hand and name no country), `{ card }` is that card lifted from the hand strip (only the choices that use it). Left out:
 * everything in one place.
 */
export type PromptPlace = "banner" | { readonly card: CardId };

/**
 * A choice's button text and the answer it sends; `cards` are the cards in the hand it uses, if any, and `country`
 * the country it names, if any (countryChoices.ts).
 */
export type Choice = { text: string; value: AnswerValue; cards?: readonly CardId[]; country?: CountryId };

/** The smallest tap target (.claude/rules/app.md). */
export const BUTTON_STYLE = { minHeight: 44, minWidth: 44 } as const;

/** The hint under the question when the choices are on the cards in the hand strip. */
export const TAP_A_CARD = "Tap a card in your hand to see what you can do with it.";

/** The hint in the banner when the choices are countries, which glow on the map (L7, #487). */
export const TAP_A_COUNTRY = "Tap a glowing country on the map.";

/** The question's id, from the decision's id (no useId: tests call prompts as plain functions). */
const questionIdOf = (decision: Decision): string => `decision-${decision.id}-question`;

function ChoiceButtons({ choices, onAnswer }: Readonly<{ choices: Choice[]; onAnswer: (value: AnswerValue) => void }>) {
  return (
    <div>
      {choices.map((choice) => (
        <button key={choice.text} type="button" style={BUTTON_STYLE} onClick={() => onAnswer(choice.value)}>
          {choice.text}
        </button>
      ))}
    </div>
  );
}

/**
 * The choices as a list of button texts and the answers they send, in a group named by its question. A read-only
 * prompt (no `onAnswer`) lists every choice as text in one place, wherever it is drawn: there is nothing to tap.
 */
export function Choices({
  decision,
  question,
  choices,
  onAnswer,
  place,
}: Readonly<{
  decision: Decision;
  question: string;
  choices: Choice[];
  onAnswer?: ((value: AnswerValue) => void) | undefined;
  place?: PromptPlace | undefined;
}>) {
  const questionId = questionIdOf(decision);
  if (onAnswer && typeof place === "object") {
    const own = choices.filter((choice) => choice.cards?.includes(place.card) === true);
    if (own.length === 0) return null;
    // Named by the question in the decision's region, so the question's words are on the screen once.
    return (
      <section role="group" aria-labelledby={questionId} className="lifted-choices">
        <ChoiceButtons choices={own} onAnswer={onAnswer} />
      </section>
    );
  }
  if (typeof place === "object") return null;
  const banner = onAnswer !== undefined && place === "banner";
  const onCards = banner && choices.some((choice) => choice.cards !== undefined);
  const onMap = banner && choices.some((choice) => choice.country !== undefined);
  const shown = banner
    ? choices.filter((choice) => choice.cards === undefined && choice.country === undefined)
    : choices;
  return (
    <section role="group" aria-labelledby={questionId}>
      <p id={questionId}>{question}</p>
      {onCards && <p className="decision-hint">{TAP_A_CARD}</p>}
      {onMap && <p className="decision-hint">{TAP_A_COUNTRY}</p>}
      {onAnswer ? (
        <ChoiceButtons choices={shown} onAnswer={onAnswer} />
      ) : (
        <ul>
          {shown.map((choice) => (
            <li key={choice.text}>{choice.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
