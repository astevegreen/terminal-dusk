// A migration file read as text by Vitest's `?raw` import, for checks the client API cannot make.
declare module "*.sql?raw" {
  const text: string;
  export default text;
}
