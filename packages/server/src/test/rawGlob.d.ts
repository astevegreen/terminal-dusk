// Vite's `import.meta.glob`, as the entitlement audit uses it to read the server's files as text. The server loads
// no Vite types, so only that one form of the call is declared.
interface ImportMeta {
  glob(patterns: string[], options: { query: "?raw"; import: "default"; eager: true }): Record<string, string>;
}
