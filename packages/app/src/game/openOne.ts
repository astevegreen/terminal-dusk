// One thing open at a time (principle 5, docs/design/screen-layout.md; #503), by keyboard as well as by touch. The
// top bar's panels (topBar.tsx) and the hand strip's lifted card (handStrip.tsx) keep their own state, and a tap
// outside closes each through its own `pointerdown` listener, but a key press fires none. So whichever opens says so
// on the document, and the other, while it is open, closes on hearing it. Kept apart from React and the DOM, so it
// is tested with a plain EventTarget. Decision (architect) on #503.

/** What opens: one of the top bar's panels, or a lifted card. */
export type Opener = "panel" | "card";

const OPENED = "td:open";

/** An "opened" signal, carrying which kind opened. */
class OpenedEvent extends Event {
  readonly who: Opener;
  constructor(who: Opener) {
    super(OPENED);
    this.who = who;
  }
}

/** Says on `doc` that `who` has just opened. */
export function announceOpen(doc: EventTarget, who: Opener): void {
  doc.dispatchEvent(new OpenedEvent(who));
}

/** While open, `who` calls `close` when the other kind opens. Returns the function that stops listening. */
export function onOtherOpen(doc: EventTarget, who: Opener, close: () => void): () => void {
  const listener = (event: Event): void => {
    if (event instanceof OpenedEvent && event.who !== who) close();
  };
  doc.addEventListener(OPENED, listener);
  return () => doc.removeEventListener(OPENED, listener);
}
