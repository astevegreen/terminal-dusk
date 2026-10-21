/**
 * Compare function for sorting strings in UTF-16 code-unit order: the same order as a sort with no compare
 * function, written out so the order is explicit. Not `localeCompare`, which can order capitals differently.
 */
export const byCodeUnit = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};
