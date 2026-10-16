// node:test reporter for test-count.mjs: one JSON line per test that ran (suites left out),
// with its file, its name and whether it was skipped or todo.
export default async function* countReporter(source) {
  for await (const { type, data } of source) {
    if ((type === "test:pass" || type === "test:fail") && data.details?.type !== "suite") {
      const skipped = (data.skip !== undefined && data.skip !== false) || (data.todo !== undefined && data.todo !== false);
      yield JSON.stringify({ file: data.file ?? null, name: data.name, skipped }) + "\n";
    }
  }
}
