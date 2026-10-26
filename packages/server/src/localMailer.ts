// The local-stack adapter for the mail port: one POST to Mailpit's send API (`<url>/api/v1/send`) per email, so
// sign-in codes land in the local Supabase stack's mail catcher. Used only when LOCAL_MAIL_URL is set. Mailpit's
// body differs from Resend's: addresses are objects. `fetch` comes from the caller (no DOM types). Only the
// reply's status is read, and nothing here logs.
import type { Email, Mailer, SendResult } from "./mailer.ts";
import type { MailFetch } from "./resendMailer.ts";

export type LocalMailerOptions = { url: string; from: string; fetch: MailFetch };

/** Splits `Name <address>` into its parts; a bare address has no name. */
function sender(from: string): { Email: string; Name?: string } {
  const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(from);
  if (!match) return { Email: from.trim() };
  const name = match[1]!.replace(/^"(.*)"$/, "$1");
  return name === "" ? { Email: match[2]!.trim() } : { Email: match[2]!.trim(), Name: name };
}

/** A `Mailer` that sends through Mailpit: 2xx is ok, 4xx rejected, anything else (or no reply) unavailable. */
export function localMailer({ url, from, fetch }: LocalMailerOptions): Mailer {
  const endpoint = `${url.replace(/\/+$/, "")}/api/v1/send`;
  const From = sender(from);
  return {
    async send(email: Email): Promise<SendResult> {
      let status: unknown;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ From, To: [{ Email: email.to }], Subject: email.subject, Text: email.text }),
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
