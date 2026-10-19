// Browser entry point: mounts the app into the #root element of index.html. The clock and the seeds are made
// here and passed down, so nothing below needs the browser's clock or random numbers.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const randomWords = (count: number): Uint32Array => crypto.getRandomValues(new Uint32Array(count));
const newSeed = (): string => Array.from(randomWords(4), (n) => n.toString(16).padStart(8, "0")).join("");
const newAiSeed = (): number => randomWords(1)[0] ?? 0;

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
  <StrictMode>
    <App clock={() => Date.now()} newSeed={newSeed} newAiSeed={newAiSeed} />
  </StrictMode>,
);
