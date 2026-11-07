// Test helper: finds an opening tag in rendered HTML by its name and attributes, in any attribute order, so a test
// says which attributes matter instead of pinning React's attribute order and every other attribute.

type Attrs = Readonly<Record<string, string>>;
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/** The attributes of one opening tag's text (`<tag a="1" b>`), a bare attribute as "". */
function attributesOf(tagText: string): Map<string, string> {
  const found = new Map<string, string>();
  const body = tagText.replace(/^<[\w-]+/, "").replace(/\/?>$/, "");
  for (const m of body.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) found.set(m[1]!, m[2] ?? "");
  return found;
}

/** Where the first `<tag>` holding every attribute in `attrs`, with those values, starts in `html`; -1 if none. */
export function tagAt(html: string, tag: string, attrs: Attrs = {}): number {
  for (const m of html.matchAll(new RegExp(String.raw`<${escapeRe(tag)}(?=[\s>/])[^>]*>`, "g"))) {
    const have = attributesOf(m[0]);
    if (Object.entries(attrs).every(([name, value]) => have.get(name) === value)) return m.index;
  }
  return -1;
}

/** Whether `html` has a `<tag>` holding every attribute in `attrs`, with those values, in any order. */
export const hasTag = (html: string, tag: string, attrs: Attrs = {}): boolean => tagAt(html, tag, attrs) !== -1;
