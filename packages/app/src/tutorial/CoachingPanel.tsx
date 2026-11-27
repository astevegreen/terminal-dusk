// The coach's words beside the tutorial game (#641): the chapter being taught and what the coach says now. A coach
// step and a hint look different (their class); #642 places the panel on the tutorial screen.
export type CoachingPanelProps = Readonly<{
  text: string | null;
  chapter: string | null;
  style: "coach" | "hint" | null;
}>;

/** Nothing when there is neither a chapter nor words; else a status region the screen reader announces. */
export function CoachingPanel({ text, chapter, style }: CoachingPanelProps) {
  if (text === null && chapter === null) return null;
  return (
    <section
      role="status"
      aria-label="Coach"
      className={style === "hint" ? "coaching coaching-hint" : "coaching coaching-coach"}
    >
      {chapter !== null && <h2 className="coaching-chapter">{chapter}</h2>}
      {text !== null && <p className="coaching-text">{text}</p>}
    </section>
  );
}
