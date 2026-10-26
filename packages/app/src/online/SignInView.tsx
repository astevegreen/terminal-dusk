// The sign-in screen drawn from a sign-in snapshot (online/signIn.ts): the email step, the code step and the
// signed-in step, each with a Back button home. It uses no hooks, so tests can walk and press it without a
// browser. The fields are uncontrolled, so the typed code never sits in React state or in the rendered page.
import type { FormEvent } from "react";
import type { AuthRefusal } from "../transport/emailAuth.ts";
import type { SignIn, SignInSnapshot } from "./signIn.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;

export const NOT_SET_UP = "Online play is not set up in this build.";

/** One plain message per refusal. */
export const REFUSAL_MESSAGE: Record<AuthRefusal, string> = {
  badEmail: "That email address does not look right. Check it and try again.",
  badCode: "The code is six digits. Check it and try again.",
  wrongCode: "That code is wrong or has expired. Try again, or send a new code.",
  tooManyRequests: "Too many tries. Wait a minute, then try again.",
  network: "Cannot reach the server. Check your connection and try again.",
};

/** The calls the screen makes on the sign-in session. */
export type SignInActions = Pick<SignIn, "sendCode" | "enterCode" | "resendCode" | "useOtherEmail" | "signOut">;

/** What a form's named field holds when it is submitted. */
function fieldValue(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  return field !== null && "value" in field && typeof field.value === "string" ? field.value : "";
}

const onSubmitted =
  (name: string, act: (value: string) => void) =>
  (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    act(fieldValue(event.currentTarget, name).trim());
  };

function Refusal({ refusal }: Readonly<{ refusal: AuthRefusal | null }>) {
  return refusal === null ? null : <p role="alert">{REFUSAL_MESSAGE[refusal]}</p>;
}

function EmailStep({ snapshot, actions }: Readonly<{ snapshot: SignInSnapshot; actions: SignInActions | null }>) {
  const off = actions === null || snapshot.busy;
  return (
    <form onSubmit={onSubmitted("email", (email) => void actions?.sendCode(email))}>
      <label>
        Email address <input type="email" name="email" autoComplete="email" style={TAP} disabled={snapshot.busy} />
      </label>
      <button type="submit" style={TAP} disabled={off}>
        Send code
      </button>
      {actions === null && <p>{NOT_SET_UP}</p>}
      <Refusal refusal={snapshot.refusal} />
    </form>
  );
}

function CodeStep({
  snapshot,
  email,
  actions,
}: Readonly<{ snapshot: SignInSnapshot; email: string; actions: SignInActions }>) {
  return (
    <form onSubmit={onSubmitted("code", (code) => void actions.enterCode(code))}>
      <p>{`We sent a 6-digit code to ${email}.`}</p>
      <label>
        Code{" "}
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          style={TAP}
          disabled={snapshot.busy}
        />
      </label>
      <button type="submit" style={TAP} disabled={snapshot.busy}>
        Sign in
      </button>
      <button type="button" style={TAP} disabled={snapshot.busy} onClick={() => void actions.resendCode()}>
        Send a new code
      </button>
      <button type="button" style={TAP} disabled={snapshot.busy} onClick={() => actions.useOtherEmail()}>
        Use a different email
      </button>
      <Refusal refusal={snapshot.refusal} />
    </form>
  );
}

function Step({ snapshot, actions }: Readonly<{ snapshot: SignInSnapshot; actions: SignInActions | null }>) {
  if (actions === null) return <EmailStep snapshot={snapshot} actions={null} />;
  switch (snapshot.kind) {
    case "loading":
      return <p>Loading…</p>;
    case "email":
      return <EmailStep snapshot={snapshot} actions={actions} />;
    case "code":
      return <CodeStep snapshot={snapshot} email={snapshot.email} actions={actions} />;
    case "signedIn":
      return (
        <>
          <p>Signed in</p>
          <button type="button" style={TAP} disabled={snapshot.busy} onClick={() => void actions.signOut()}>
            Sign out
          </button>
        </>
      );
  }
}

/** The online screen for one snapshot. `actions` is null when this build has no online play set up. */
export function SignInView({
  snapshot,
  actions,
  onBack,
}: Readonly<{ snapshot: SignInSnapshot; actions: SignInActions | null; onBack: () => void }>) {
  return (
    <main>
      <h1>Play online</h1>
      <Step snapshot={snapshot} actions={actions} />
      <button type="button" style={TAP} onClick={onBack}>
        Back
      </button>
    </main>
  );
}
