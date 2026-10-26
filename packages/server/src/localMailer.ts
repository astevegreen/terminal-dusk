// The local-stack adapter for the mail port: one POST to Mailpit's send API (`<url>/api/v1/send`) per email, so
// sign-in codes land in the local Supabase stack's mail catcher. Used only when LOCAL_MAIL_URL is set. Mailpit's
// body differs from Resend's: addresses are objects. `fetch` comes from the caller (no DOM types). Only the
// reply's status is read, and nothing here logs.
import type { Email, Mailer, SendResult } from "./mailer.ts";
import type { MailFetch } from "./resendMailer.ts";

export type LocalMailerOptions = { url: string; from: string; fetch: MailFetch };

/** Splits `Name <address>` into its parts; a bare address has no name. Plain string steps, no regex backtracking. */
function sender(from: string): { Email: string; Name?: string } {
  const text = from.trim();
  const open = text.lastIndexOf("<");
  const address = open >= 0 && text.endsWith(">") ? text.slice(open + 1, -1).trim() : "";
  if (address === "" || address.includes(">")) return { Email: text };
  let name = text.slice(0, open).trim();
  if (name.length >= 2 && name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
  return name === "" ? { Email: address } : { Email: address, Name: name };
}

/** `url` without its trailing slashes. */
function withoutTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end--;
  return url.slice(0, end);
}

/** A `Mailer` that sends through Mailpit: 2xx is ok, 4xx rejected, anything else (or no reply) unavailable. */
export function localMailer({ url, from, fetch }: LocalMailerOptions): Mailer {
  const endpoint = `${withoutTrailingSlashes(url)}/api/v1/send`;
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
