// One country on the drawn map (L2, #465): a small box at its place, filled in its controller's colour, with its
// short name, a battleground mark, LIO's influence, its stability and SAE's influence. A reader hears the full
// line instead. `memo` with plain-value props, so a frame redraws only the markers whose numbers changed.
import type { CountryId } from "@terminal-dusk/engine";
import { memo } from "react";
import type { Point } from "./layout.ts";
import { MARKER } from "./layout.ts";

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
};

/** Where a box centred on `at` starts, as CSS. */
export const placeOf = (at: Point) => ({ left: at.x - MARKER.w / 2, top: at.y - MARKER.h / 2 });

/** The marker's whole line, for a screen reader. */
export const markerText = (p: Readonly<MarkerProps>): string =>
  `${p.name}: LIO ${p.lio}, SAE ${p.sae}, stability ${p.stability}${p.battleground ? ", battleground" : ""}`;

function MarkerInner(props: Readonly<MarkerProps>) {
  const { id, name, short, x, y, lio, sae, stability, control, battleground, touched } = props;
  return (
    <li
      className="dm-marker"
      data-country={id}
      data-control={control}
      data-battleground={battleground ? "true" : undefined}
      data-touched={touched ? "true" : undefined}
      title={name}
      style={placeOf({ x, y })}
    >
      <span className="dm-sr">{markerText(props)}</span>
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
