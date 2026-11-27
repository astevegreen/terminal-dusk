// Buying, restoring and redeeming (#685), drawn on the Full Game offer and in the account area. They only ask the
// Platform's purchases and say the answer in words; a signed-out player is taken to sign-in.
import { useContext, useState } from "react";
import type { FormEvent } from "react";
import { PurchaseError } from "../platform/purchases.ts";
import type { PurchaseArrival, PurchaseRefusal } from "../platform/purchases.ts";
import { PurchaseDeskContext } from "./desk.ts";
import type { PurchaseDesk } from "./desk.ts";
import * as text from "./purchaseText.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;
const PART = { flex: "1 1 240px", minWidth: 0 } as const;

type Answer = { refused: PurchaseRefusal } | "restored" | "redeemed" | null;

/** One request at a time: `busy` while it runs, then its answer. */
function useRequest(desk: PurchaseDesk | null) {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer>(null);
  const ask = async (request: () => Promise<Answer>): Promise<void> => {
    setBusy(true);
    setAnswer(null);
    try {
      setAnswer(await request());
    } catch (error) {
      const refused = error instanceof PurchaseError ? error.code : "network";
      setAnswer({ refused });
      if (refused === "notSignedIn") desk?.openSignIn();
    } finally {
      setBusy(false);
    }
  };
  return { busy, answer, ask };
}

/** An answer in words. "Restored" says what is owned now, which may be nothing. */
function Said({ answer, owned }: Readonly<{ answer: Answer; owned: boolean }>) {
  if (answer === null) return null;
  if (typeof answer === "object") return <p role="alert">{text.PURCHASE_REFUSAL[answer.refused]}</p>;
  const restored = owned ? text.RESTORED : text.NOTHING_TO_RESTORE;
  return (
    <p>
      <output>{answer === "restored" ? restored : text.REDEEMED}</output>
    </p>
  );
}

/** The buy button: off where the Platform sells nothing. */
export function BuyButton() {
  const desk = useContext(PurchaseDeskContext);
  const { busy, answer, ask } = useRequest(desk);
  const buy = async (from: PurchaseDesk): Promise<Answer> => {
    const result = await from.purchases.unlock();
    if (result.status === "signIn") from.openSignIn();
    return result.status === "refused" ? { refused: result.code } : null;
  };
  return (
    <>
      <button
        type="button"
        style={TAP}
        disabled={!desk || busy}
        onClick={desk ? () => void ask(() => buy(desk)) : undefined}
      >
        {text.OFFER_BUY}
      </button>
      <Said answer={answer} owned={desk?.owned ?? false} />
    </>
  );
}

/** Restore purchase, and the gift code field where the Platform takes codes. Nothing where it sells nothing. */
export function RestoreAndRedeem() {
  const desk = useContext(PurchaseDeskContext);
  const { busy, answer, ask } = useRequest(desk);
  if (!desk) return null;
  const { purchases } = desk;
  const restore = async (): Promise<Answer> => {
    await purchases.restore();
    return "restored";
  };
  const redeem = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = new FormData(form).get("gift-code");
    void ask(async () => {
      await purchases.redeemCode?.(typeof code === "string" ? code : "");
      form.reset();
      return "redeemed";
    });
  };
  return (
    <div>
      <button type="button" style={TAP} disabled={busy} onClick={() => void ask(restore)}>
        {text.RESTORE}
      </button>
      {purchases.redeemCode && (
        <form onSubmit={redeem}>
          <label>
            {text.GIFT_CODE}{" "}
            <input
              type="text"
              name="gift-code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              style={TAP}
              disabled={busy}
            />
          </label>{" "}
          <button type="submit" style={TAP} disabled={busy}>
            {text.REDEEM}
          </button>
        </form>
      )}
      <Said answer={answer} owned={desk.owned} />
    </div>
  );
}

/** The account area's part about the Full Game; nothing where the Platform sells nothing. */
export function AccountPurchases() {
  const desk = useContext(PurchaseDeskContext);
  if (!desk) return null;
  return (
    <section style={PART} aria-labelledby="account-full-game">
      <h2 id="account-full-game">{text.ACCOUNT_TITLE}</h2>
      {desk.owned ? (
        <p>{text.OWNED}</p>
      ) : (
        <>
          <BuyButton />
          <p>{desk.note}</p>
        </>
      )}
      <RestoreAndRedeem />
    </section>
  );
}

/** What the app says after a return from the payment page until the purchase is there (the home screen's notice). */
export function PurchaseNotice({ arrival, onRestore }: Readonly<{ arrival: PurchaseArrival; onRestore: () => void }>) {
  if (arrival === "none") return null;
  return (
    <div>
      <p>
        <output>{text.ARRIVAL[arrival]}</output>
      </p>
      {arrival === "late" && (
        <button type="button" style={TAP} onClick={onRestore}>
          {text.RESTORE}
        </button>
      )}
    </div>
  );
}
