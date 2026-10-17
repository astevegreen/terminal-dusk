// State is plain JSON, so a JSON round trip is a complete copy that shares nothing with the original.
export const copyJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
