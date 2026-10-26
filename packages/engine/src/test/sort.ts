// Test helper: the sort order the tests use for object keys and card ids.

/**
 * Text by UTF-16 code unit, the order a bare sort with no compare function gives (so "Z" comes before "a"). Unlike
 * `localeCompare`, it never depends on the machine's language settings.
 */
export function byCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
