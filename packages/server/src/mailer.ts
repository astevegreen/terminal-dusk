// The mail port (docs/architecture.md, Decision 5, "Accounts and purchases"): sign-in codes and turn alerts
// go out through a paid email provider. The rest of the server sends through `Mailer` and never learns which
// provider is behind it. `MemoryMailer` records what was sent, for tests.

import { later } from "./later.ts";

/** One plain-text email. */
export type Email = { to: string; subject: string; text: string };
/** How a send went: accepted by the provider, refused by it (`rejected`), or the provider was not reached (`unavailable`). */
export type SendResult = { ok: true } | { ok: false; code: "rejected" | "unavailable" };
/** Anything that can send an email. It answers with a result and never throws. */
export interface Mailer {
  send(email: Email): Promise<SendResult>;
}

type Failure = "rejected" | "unavailable";

/** A mailer for tests: keeps every sent email in order, and can be told to fail the next send. */
export class MemoryMailer implements Mailer {
  /** The emails sent so far, oldest first. A failed send is not in this list. */
  readonly sent: Email[] = [];
  private readonly failures: Failure[] = [];

  /** The next send answers with this failure instead of sending. Calls queue up, one per send. */
  failNext(code: Failure): void {
    this.failures.push(code);
  }

  send(email: Email): Promise<SendResult> {
    return later((): SendResult => {
      const failure = this.failures.shift();
      if (failure !== undefined) return { ok: false, code: failure };
      this.sent.push({ to: email.to, subject: email.subject, text: email.text });
      return { ok: true };
    });
  }
}
