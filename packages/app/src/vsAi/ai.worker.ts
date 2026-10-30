// The AI's Web Worker: it only passes each message to the AI package's handler and posts the reply back.
// With the tests, this is the only app file that imports @terminal-dusk/ai (the app uses `ai` "as a worker").
import { createAiWorkerHandler } from "@terminal-dusk/ai";
import type { AiRequest, AiResponse } from "@terminal-dusk/ai";

type WorkerScope = {
  onmessage: ((event: MessageEvent<AiRequest>) => void) | null;
  postMessage(response: AiResponse): void;
};

const scope = self as unknown as WorkerScope;
// The worker passes the clock Hard stops its search by; the AI package never reads one itself.
const handle = createAiWorkerHandler({ now: () => performance.now() });
scope.onmessage = (event) => {
  const response = handle(event.data);
  if (response) scope.postMessage(response);
};
