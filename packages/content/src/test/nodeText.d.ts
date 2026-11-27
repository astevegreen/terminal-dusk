// The content package loads no Node types (tsconfig.base.json: "types": []), so only the one form its tests use to
// read a design doc is declared here: readFileSync of a file URL as UTF-8 text (#700, firstGameLesson.test.ts).
declare module "node:fs" {
  export function readFileSync(path: URL, encoding: "utf8"): string;
}

declare class URL {
  constructor(url: string, base: string);
}

interface ImportMeta {
  readonly url: string;
}
