import { describe, expect, it } from "vitest";
import { MemoryMailer } from "./mailer.ts";
import type { Mailer } from "./mailer.ts";

const email = (n: number) => ({ to: `player${n}@example.test`, subject: `Subject ${n}`, text: `Text ${n}` });

describe("MemoryMailer", () => {
  it("implements Mailer and keeps every sent email in order", async () => {
    const mailer: Mailer = new MemoryMailer();
    expect(await mailer.send(email(1))).toEqual({ ok: true });
    expect(await mailer.send(email(2))).toEqual({ ok: true });
    expect((mailer as MemoryMailer).sent).toEqual([email(1), email(2)]);
  });

  it("answers rejected for the next send when told to, then sends again", async () => {
    const mailer = new MemoryMailer();
    mailer.failNext("rejected");
    expect(await mailer.send(email(1))).toEqual({ ok: false, code: "rejected" });
    expect(await mailer.send(email(2))).toEqual({ ok: true });
    expect(mailer.sent).toEqual([email(2)]);
  });

  it("answers unavailable for the next send when told to", async () => {
    const mailer = new MemoryMailer();
    mailer.failNext("unavailable");
    expect(await mailer.send(email(1))).toEqual({ ok: false, code: "unavailable" });
    expect(mailer.sent).toEqual([]);
  });

  it("keeps a copy, so changing the email after sending does not change the record", async () => {
    const mailer = new MemoryMailer();
    const sent = email(1);
    await mailer.send(sent);
    sent.subject = "changed";
    expect(mailer.sent[0]!.subject).toBe("Subject 1");
  });
});
