// The Resend adapter for the mail port: one POST to Resend's send-email endpoint per email. The API key and
// sender address come from the caller (no key, address or account is kept in the repository), and so does
// `fetch`, since the server's compiler settings name no DOM types. Only the reply's status is read, so
// nothing the provider says, and never the key, reaches a result. Nothing here logs.
import type { Email, Mailer, SendResult } from "./mailer.ts";

/** Resend's public send-email endpoint. */
export const RESEND_SEND_URL = "https://api.resend.com/emails";

/** The part of the fetch API this adapter uses. */
export type MailFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number }>;

export type ResendOptions = { apiKey: string; from: string; fetch: MailFetch };

/** A `Mailer` that sends through Resend: 2xx is ok, 4xx rejected, anything else (or no reply) unavailable. */
export function resendMailer({ apiKey, from, fetch }: ResendOptions): Mailer {
  return {
    async send(email: Email): Promise<SendResult> {
      let status: unknown;
      try {
        const response = await fetch(RESEND_SEND_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
        });
        status = response.status;
      } catch {
        return { ok: false, code: "unavailable" };
      }
      if (typeof status !== "number") return { ok: false, code: "unavailable" };
      if (status >= 200 && status < 300) return { ok: true };
      if (status >= 400 && status < 500) return { ok: false, code: "rejected" };
      return { ok: false, code: "unavailable" };
    },
  };
}
