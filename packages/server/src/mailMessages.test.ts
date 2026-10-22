import { describe, expect, it } from "vitest";
import { signInCodeEmail, turnAlertEmail } from "./mailMessages.ts";

describe("signInCodeEmail", () => {
  it("puts the 6-digit code in the subject and the text, addressed to the player", () => {
    const email = signInCodeEmail("player@example.test", "048213");
    expect(email.to).toBe("player@example.test");
    expect(email.subject).toContain("048213");
    expect(email.text).toContain("048213");
  });

  it("has no link of any kind (no magic link)", () => {
    const email = signInCodeEmail("player@example.test", "123456");
    for (const part of [email.subject, email.text]) {
      expect(part).not.toMatch(/https?:/i);
      expect(part).not.toMatch(/www\./i);
      expect(part).not.toMatch(/:\/\//);
    }
  });

  it("says the code was asked for on this address and can be ignored otherwise", () => {
    const { text } = signInCodeEmail("player@example.test", "123456");
    expect(text).toMatch(/asked for this code/i);
    expect(text).toMatch(/this email address/i);
    expect(text).toMatch(/ignore/i);
  });

  it("refuses a code that is not exactly 6 digits", () => {
    for (const bad of ["", "12345", "1234567", "12a456", " 123456", "123456 ", "12 456", "١٢٣٤٥٦"]) {
      expect(() => signInCodeEmail("player@example.test", bad)).toThrow(Error);
    }
  });
});

describe("turnAlertEmail", () => {
  it("says a move is waiting in Terminal Dusk and gives the app address", () => {
    const email = turnAlertEmail("player@example.test", "https://play.example.test/");
    expect(email.to).toBe("player@example.test");
    expect(email.subject).toMatch(/move/i);
    expect(email.text).toMatch(/move is waiting/i);
    expect(email.text).toContain("Terminal Dusk");
    expect(email.text).toContain("https://play.example.test/");
  });

  it("takes only an address and the app URL, so it cannot carry match state", () => {
    expect(turnAlertEmail.length).toBe(2);
  });
});
