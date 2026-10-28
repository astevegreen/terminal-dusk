// The watch link for an online game: the app's address with `?watch=<matchId>`. Anyone with the link may watch
// (docs/architecture.md, Decision 5: the match row and the spectator rows are readable by everyone).

/** The link that opens `matchId` as a watch screen, from the app's own address `base`. */
export function watchLinkFor(base: string, matchId: string): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("watch", matchId);
  return url.toString();
}

/** The match id in a page's query string (`location.search`), or null when it is not a watch link. */
export function matchIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get("watch");
  return id === null || id === "" ? null : id;
}
