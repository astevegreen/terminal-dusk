// Coming back from the payment page (#685): the app reads the entitlements again, keeps trying for a while because
// the payment's news may reach the server late, and says so when it still isn't there.
import { describe, expect, it } from "vitest";
import { WEB_ROW } from "../entitlements/test/fakeEntitlements.ts";
import { STORED } from "../online/test/signInRig.ts";
import { fakeTimers, settle } from "../transport/test/remoteGame.ts";
import { purchaseRig } from "./test/purchaseRig.ts";
import { RETURN_DELAYS, createPurchaseReturn, purchaseReturned, withoutPurchaseReturn } from "./webPurchaseReturn.ts";

const OWNS = { status: 200, body: [WEB_ROW] };

async function returning(returned = true) {
  const rig = await purchaseRig(STORED);
  await settle();
  const timers = fakeTimers();
  const arrival = createPurchaseReturn({ returned, entitlements: rig.entitlements, timers });
  const reads = (): number => rig.fake.reads().length;
  return { ...rig, timers, arrival, reads };
}

describe("the address the payment page comes back to (#685)", () => {
  it("is known by ?purchase=done and nothing else", () => {
    expect(purchaseReturned("?purchase=done")).toBe(true);
    expect(purchaseReturned("?watch=m1&purchase=done")).toBe(true);
    expect(purchaseReturned("?purchase=failed")).toBe(false);
    expect(purchaseReturned("")).toBe(false);
  });

  it("is taken out of the address bar, keeping the rest", () => {
    expect(withoutPurchaseReturn("https://app.test/?purchase=done")).toBe("https://app.test/");
    expect(withoutPurchaseReturn("https://app.test/x?watch=m1&purchase=done#a")).toBe("https://app.test/x?watch=m1#a");
  });
});

describe("coming back from the payment page (#685)", () => {
  it("does nothing for an ordinary start", async () => {
    const { arrival, timers, reads } = await returning(false);
    const before = reads();
    arrival.start();
    await settle();
    expect(arrival.getArrival()).toBe("none");
    expect(reads()).toBe(before);
    expect(timers.waiting()).toEqual([]);
  });

  it("reloads the entitlements at once, and stops once the web entitlement is there", async () => {
    const { arrival, fake, entitlements, timers, reads } = await returning();
    const before = reads();
    fake.answerNext(OWNS);
    arrival.start();
    expect(arrival.getArrival()).toBe("waiting");
    await settle();
    expect(reads()).toBe(before + 1);
    expect(entitlements.getSnapshot().owned).toEqual([WEB_ROW]);
    expect(arrival.getArrival()).toBe("none");
    expect(timers.waiting()).toEqual([]);
  });

  it("tries again, longer apart each time, while the payment's news is late", async () => {
    const { arrival, fake, timers } = await returning();
    arrival.start();
    await settle();
    const waited: number[] = [];
    for (let i = 0; i < RETURN_DELAYS.length - 1; i++) {
      waited.push(...timers.waiting());
      timers.fire();
      await settle();
    }
    expect(waited).toEqual(RETURN_DELAYS.slice(0, -1));
    expect([...RETURN_DELAYS]).toEqual([2000, 4000, 8000, 16000, 30000]);
    fake.answerNext(OWNS);
    timers.fire();
    await settle();
    expect(arrival.getArrival()).toBe("none");
  });

  it("says the purchase is late after the last try, and no longer once it appears", async () => {
    const { arrival, fake, entitlements, timers, reads } = await returning();
    const before = reads();
    let told = 0;
    arrival.subscribe(() => told++);
    arrival.start();
    await settle();
    for (let i = 0; i < RETURN_DELAYS.length; i++) {
      expect(arrival.getArrival()).toBe("waiting");
      timers.fire();
      await settle();
    }
    expect(arrival.getArrival()).toBe("late");
    expect(reads()).toBe(before + 1 + RETURN_DELAYS.length);
    expect(timers.waiting()).toEqual([]);
    fake.answerNext(OWNS);
    await entitlements.reload();
    expect(arrival.getArrival()).toBe("none");
    expect(told).toBeGreaterThanOrEqual(2);
  });

  it("asks nothing more once stopped, and begins again when started again", async () => {
    const { arrival, timers, reads } = await returning();
    const stop = arrival.start();
    stop();
    await settle();
    expect(timers.waiting()).toEqual([]);
    const before = reads();
    const stopAgain = arrival.start();
    await settle();
    expect(reads()).toBe(before + 1);
    expect(timers.waiting()).toEqual([RETURN_DELAYS[0]]);
    stopAgain();
    expect(timers.waiting()).toEqual([]);
  });
});
