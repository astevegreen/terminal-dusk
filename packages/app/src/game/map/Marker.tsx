// One country on the drawn map (L2, #465): a small box at its place, filled in its controller's colour, with its
// short name, a battleground mark, LIO's influence, its stability and SAE's influence. A reader hears the full
// line instead. `memo` with plain-value props, so a frame redraws only the markers whose numbers changed.
// When a decision asks for a country (L7, #487), the countries you may pick glow and hold a button named after the
// choice, which the keyboard reaches with Tab; the rest dim, and a tap on one falls through to its region.
import type { CountryId } from "@terminal-dusk/engine";
import { memo } from "react";
import type { FocusEvent, MouseEvent } from "react";
import type { Point } from "./layout.ts";
import { MARKER } from "./layout.ts";
import type { Beat } from "./pulse.ts";

/** What the map does with a glowing country: `keyboard` is true for a click from Enter or a screen reader. */
export type PickHandlers = {
  pick: (country: CountryId, keyboard: boolean) => void;
  /** The keyboard's focus came to the country's button: the map moves to show it. */
  reveal: (country: CountryId) => void;
};

/** "glow": you may pick it now; "dim": a country decision waits, but not for this one; null: none waits. */
export type PickState = "glow" | "dim" | null;

export type MarkerProps = {
  id: CountryId;
  name: string;
  short: string;
  /** Its centre in the layout. */
  x: number;
  y: number;
  lio: number;
  sae: number;
  stability: number;
  /** "lio", "sae" or "none", from the engine's controller. */
  control: string;
  battleground: boolean;
  /** The latest frame's events touched this country. */
  touched: boolean;
  /** On a touched country, the pulse's beat (pulse.ts): its change starts the pulse again. */
  pulse?: Beat | undefined;
  /** Whether you may pick it now (L7, #487). */
  pick?: PickState | undefined;
  /** The choice's text when it glows, such as "Place in Ukraine": its button's name starts with it. */
  choice?: string | undefined;
  /** Kept the same from frame to frame (ZoomableMap), so `memo` still skips unchanged markers. */
  on?: PickHandlers | undefined;
};

/** Where a box centred on `at` starts, as CSS. */
export const placeOf = (at: Point) => ({ left: at.x - MARKER.w / 2, top: at.y - MARKER.h / 2 });

/** The marker's numbers, after its name or its choice, for a screen reader. */
const numbersText = (p: Readonly<MarkerProps>): string =>
  `LIO ${p.lio}, SAE ${p.sae}, stability ${p.stability}${p.battleground ? ", battleground" : ""}`;

/** The marker's whole line, for a screen reader. */
export const markerText = (p: Readonly<MarkerProps>): string => `${p.name}: ${numbersText(p)}`;

/** A glowing country's button name: "Place in Ukraine: LIO 1, SAE 0, stability 2". */
export const pickText = (p: Readonly<MarkerProps>): string => `${p.choice ?? p.name}: ${numbersText(p)}`;

/** Whether the keyboard (not a pointer) brought the focus here; a browser without `:focus-visible` counts it so. */
function byKeyboard(target: Element): boolean {
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}

function MarkerInner(props: Readonly<MarkerProps>) {
  const { id, name, short, x, y, lio, sae, stability, control, battleground, touched, pulse, pick, choice, on } = props;
  const glows = pick === "glow" && choice !== undefined && on !== undefined;
  return (
    <li
      className="dm-marker"
      data-country={id}
      data-control={control}
      data-battleground={battleground ? "true" : undefined}
      data-touched={touched ? "true" : undefined}
      data-pulse={touched ? pulse : undefined}
      data-pick={pick ?? undefined}
      title={name}
      style={placeOf({ x, y })}
    >
      {glows ? (
        <button
          type="button"
          className="dm-pick"
          data-choice={choice}
          onClick={(event: MouseEvent<HTMLButtonElement>) => on.pick(id, event.detail === 0)}
          onFocus={(event: FocusEvent<HTMLButtonElement>) => {
            if (byKeyboard(event.currentTarget)) on.reveal(id);
          }}
        >
          <span className="dm-sr">{pickText(props)}</span>
        </button>
      ) : (
        <span className="dm-sr">{markerText(props)}</span>
      )}
      <span className="dm-name" aria-hidden="true">
        {short}
        {battleground && <span className="dm-bg">{"◆"}</span>}
      </span>
      <span className="dm-nums" aria-hidden="true">
        <span className="dm-lio">{lio}</span>
        <span className="dm-stab">{stability}</span>
        <span className="dm-sae">{sae}</span>
      </span>
    </li>
  );
}

export const Marker = memo(MarkerInner);
