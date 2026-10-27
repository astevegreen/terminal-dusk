import { describe, expect, it } from "vitest";
import { mailerFromEnv, startupLogLine } from "./authEmailEdge.ts";
import { localMailer } from "./localMailer.ts";
import type { MailFetch } from "./resendMailer.ts";
import { authEmailWorld, payload, signedRequest, TEST_CODE, TEST_EMAIL, TEST_SECRET } from "./test/authEmail.ts";
import { handleAuthEmail } from "./authEmailHandler.ts";

const URL = "http://host.docker.internal:44324";
const EMAIL = { to: "player@example.test", subject: "Hello", text: "Body text 123456" };

type Call = { url: string; init: { method: string; headers: Record<string, string>; body: string } };

function fakeFetch(status: number): { fetch: MailFetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: MailFetch = async (url, init) => {
    calls.push({ url, init });
    return { status };
  };
  return { fetch, calls };
}

describe("localMailer", () => {
  it("criterion 1: one POST to <url>/api/v1/send with Mailpit's nested address body for a bare sender", async () => {
    const { fetch, calls } = fakeFetch(200);
    await localMailer({ url: URL, from: "sign-in@localhost", fetch }).send(EMAIL);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${URL}/api/v1/send`);
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0]!.init.body)).toEqual({
      From: { Email: "sign-in@localhost" },
      To: [{ Email: EMAIL.to }],
      Subject: EMAIL.subject,
      Text: EMAIL.text,
    });
  });

  it("criterion 1: a 'Name <address>' sender is split into Email and Name", async () => {
    const { fetch, calls } = fakeFetch(200);
    await localMailer({ url: URL, from: "Terminal Dusk <sender@example.test>", fetch }).send(EMAIL);
    expect(JSON.parse(calls[0]!.init.body).From).toEqual({ Email: "sender@example.test", Name: "Terminal Dusk" });
  });

  it("criterion 1: a trailing slash on the url is dropped, so there is never //api", async () => {
    for (const url of [`${URL}/`, `${URL}//`]) {
      const { fetch, calls } = fakeFetch(200);
      await localMailer({ url, from: "a@b.test", fetch }).send(EMAIL);
      expect(calls[0]!.url).toBe(`${URL}/api/v1/send`);
    }
  });

  it("criterion 1: 2xx is ok, 4xx rejected, anything else unavailable", async () => {
    const send = (status: number) =>
      localMailer({ url: URL, from: "a@b.test", fetch: fakeFetch(status).fetch }).send(EMAIL);
    expect(await send(200)).toEqual({ ok: true });
    expect(await send(299)).toEqual({ ok: true });
    expect(await send(400)).toEqual({ ok: false, code: "rejected" });
    expect(await send(499)).toEqual({ ok: false, code: "rejected" });
    expect(await send(500)).toEqual({ ok: false, code: "unavailable" });
    expect(await send(302)).toEqual({ ok: false, code: "unavailable" });
  });

  it("criterion 1: a thrown or rejected fetch, or a reply with no status, is unavailable", async () => {
    const down = { ok: false, code: "unavailable" };
    const rejecting: MailFetch = () => Promise.reject(new Error("down"));
    const throwing: MailFetch = () => {
      throw new Error("boom");
    };
    const noStatus = (async () => ({})) as unknown as MailFetch;
    for (const fetch of [rejecting, throwing, noStatus]) {
      expect(await localMailer({ url: URL, from: "a@b.test", fetch }).send(EMAIL)).toEqual(down);
    }
  });
});

describe("mailerFromEnv", () => {
  const fetch = fakeFetch(200).fetch;
  const name = (env: Record<string, string | undefined>) => mailerFromEnv(env, fetch).name;

  it("criterion 2: LOCAL_MAIL_URL selects the local mailer, even when Resend is also configured", () => {
    expect(name({ LOCAL_MAIL_URL: URL })).toBe("local");
    expect(name({ LOCAL_MAIL_URL: URL, RESEND_API_KEY: "k", MAIL_FROM: "a@b.test" })).toBe("local");
  });

  it("criterion 2: the local mailer sends from MAIL_FROM, or sign-in@localhost when it is unset or empty", async () => {
    for (const [env, expected] of [
      [
        { LOCAL_MAIL_URL: URL, MAIL_FROM: "Td <x@y.test>" },
        { Email: "x@y.test", Name: "Td" },
      ],
      [{ LOCAL_MAIL_URL: URL }, { Email: "sign-in@localhost" }],
      [{ LOCAL_MAIL_URL: URL, MAIL_FROM: "" }, { Email: "sign-in@localhost" }],
    ] as const) {
      const f = fakeFetch(200);
      await mailerFromEnv(env, f.fetch).mailer.send(EMAIL);
      expect(f.calls[0]!.url).toBe(`${URL}/api/v1/send`);
      expect(JSON.parse(f.calls[0]!.init.body).From).toEqual(expected);
    }
  });

  it("criterion 2: without LOCAL_MAIL_URL, Resend needs both key and sender, else unconfigured", () => {
    expect(name({ RESEND_API_KEY: "k", MAIL_FROM: "a@b.test" })).toBe("resend");
    expect(name({ RESEND_API_KEY: "k" })).toBe("unconfigured");
    expect(name({ MAIL_FROM: "a@b.test" })).toBe("unconfigured");
    expect(name({})).toBe("unconfigured");
  });

  it("criterion 2: a variable set to an empty string counts as unset", () => {
    expect(name({ LOCAL_MAIL_URL: "" })).toBe("unconfigured");
    expect(name({ LOCAL_MAIL_URL: "", RESEND_API_KEY: "k", MAIL_FROM: "a@b.test" })).toBe("resend");
    expect(name({ RESEND_API_KEY: "", MAIL_FROM: "a@b.test" })).toBe("unconfigured");
    expect(name({ RESEND_API_KEY: "k", MAIL_FROM: "" })).toBe("unconfigured");
  });

  it("criterion 2: the unconfigured mailer answers unavailable", async () => {
    expect(await mailerFromEnv({}, fetch).mailer.send(EMAIL)).toEqual({ ok: false, code: "unavailable" });
  });

  it("criterion 2: the startup line carries only the mailer's name", () => {
    expect(startupLogLine("local")).toBe("auth-email: using the local mail catcher");
    expect(startupLogLine("resend")).toBe("auth-email: using Resend");
    expect(startupLogLine("unconfigured")).toBe(
      "auth-email: mail provider not configured; sign-in codes will not be sent",
    );
  });
});

describe("leak test", () => {
  it("criterion 3: no result, request log or startup line carries the code, address, secrets, url, sender or key", async () => {
    const SECRET_URL = "http://catcher.secret-host.test:1";
    const SECRET_FROM = "leaky-sender@secret-host.test";
    const SECRET_KEY = "re_secret_key_zzz";
    const env = { LOCAL_MAIL_URL: SECRET_URL, MAIL_FROM: SECRET_FROM, RESEND_API_KEY: SECRET_KEY };
    const forbidden = [TEST_CODE, TEST_EMAIL, TEST_SECRET, SECRET_URL, SECRET_FROM, SECRET_KEY, "secret-host"];
    const seen: string[] = [];
    for (const status of [200, 400, 500]) {
      const fetch: MailFetch = async () => ({ status, text: async () => forbidden.join(" ") }) as { status: number };
      const picked = mailerFromEnv(env, fetch);
      seen.push(startupLogLine(picked.name));
      const world = authEmailWorld();
      const deps = { ...world.deps, mailer: picked.mailer };
      const body = payload("magiclink");
      const reply = await handleAuthEmail(deps, await signedRequest(body));
      seen.push(JSON.stringify(reply), ...world.logs);
      seen.push(JSON.stringify(await picked.mailer.send({ to: TEST_EMAIL, subject: "s", text: TEST_CODE })));
    }
    const rejecting: MailFetch = () => Promise.reject(new Error(forbidden.join(" ")));
    seen.push(JSON.stringify(await mailerFromEnv(env, rejecting).mailer.send(EMAIL)));
    for (const text of seen) for (const secret of forbidden) expect(text).not.toContain(secret);
  });
});
