import { afterEach, describe, expect, it, vi } from "vitest";
import { silentAudio, unlockOnGesture, webAudio } from "./audio.ts";
import type { SoundContext } from "./audio.ts";

const MANIFEST = {
  sounds: [
    { id: "uiTap", file: "tap.ogg" },
    { id: "reveal", file: "reveal.ogg" },
  ],
};

/** Lets the loads and the resume finish. */
const settle = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

/** A stand-in for the browser's AudioContext: it starts suspended and records what it was told to play. */
function fakeContext({ allowsResume = () => true }: { allowsResume?: () => boolean } = {}) {
  const heard = { made: 0, resumes: 0, played: [] as string[], connections: [] as string[] };
  const volume = { value: -1 };
  let state = "suspended";
  const context: SoundContext = {
    get state() {
      return state;
    },
    destination: "speakers",
    resume: async () => {
      heard.resumes += 1;
      if (allowsResume()) state = "running";
    },
    decodeAudioData: async (data) => new TextDecoder().decode(data),
    createGain: () => ({ gain: volume, connect: (to) => heard.connections.push(`volume>${String(to)}`) }),
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        connect: (to: unknown) => heard.connections.push(to === "speakers" ? "source>speakers" : "source>volume"),
        start: () => heard.played.push(String(source.buffer)),
      };
      return source;
    },
  };
  const make = (): SoundContext => {
    heard.made += 1;
    return context;
  };
  return { make, context, heard, volume };
}

/** A loader that hands back each file's address as its bytes, and records what was asked for. */
function fakeLoader(failing: readonly string[] = []) {
  const asked: string[] = [];
  const load = async (url: string): Promise<ArrayBuffer> => {
    asked.push(url);
    if (failing.includes(url)) throw new Error("no such file");
    return new TextEncoder().encode(url).buffer;
  };
  return { load, asked };
}

const ready = async (manifest = MANIFEST, failing: readonly string[] = []) => {
  const fake = fakeContext();
  const loader = fakeLoader(failing);
  const audio = webAudio(manifest, fake.make, loader.load);
  audio.unlock();
  await settle();
  return { ...fake, ...loader, audio };
};

afterEach(() => vi.unstubAllGlobals());

describe("webAudio", () => {
  it("plays nothing before unlock: no context is made and no file is asked for", async () => {
    const fake = fakeContext();
    const loader = fakeLoader();
    const audio = webAudio(MANIFEST, fake.make, loader.load);
    audio.play("uiTap");
    await settle();
    expect({ ...fake.heard, asked: loader.asked }).toMatchObject({ made: 0, played: [], asked: [] });
  });

  it("after unlock, plays the id's own file, once per call, through the volume control", async () => {
    const { audio, heard } = await ready();
    audio.play("reveal");
    expect(heard.played).toEqual(["sounds/reveal.ogg"]);
    expect(heard.connections).toEqual(["volume>speakers", "source>volume"]);
    audio.play("uiTap");
    audio.play("uiTap");
    expect(heard.played).toEqual(["sounds/reveal.ogg", "sounds/tap.ogg", "sounds/tap.ogg"]);
  });

  it("asks only for the manifest's files, each once however often the player taps", async () => {
    const { audio, asked, heard } = await ready();
    audio.unlock();
    audio.unlock();
    await settle();
    expect(asked).toEqual(["sounds/tap.ogg", "sounds/reveal.ogg"]);
    expect(heard.made).toBe(1);
    expect(heard.resumes).toBe(1);
  });

  it("is silent for an id with no file", async () => {
    const { audio, heard } = await ready();
    audio.play("victory");
    expect(heard.played).toEqual([]);
  });

  it("with an empty manifest asks for nothing and raises no error, even with the real file loader", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    const fake = fakeContext();
    const audio = webAudio({ sounds: [] }, fake.make);
    audio.unlock();
    await settle();
    expect(() => audio.play("uiTap")).not.toThrow();
    expect(fetched).not.toHaveBeenCalled();
    expect(fake.heard.played).toEqual([]);
  });

  it("plays nothing while the browser keeps the sound suspended, and a later gesture starts it", async () => {
    let allowed = false;
    const fake = fakeContext({ allowsResume: () => allowed });
    const audio = webAudio(MANIFEST, fake.make, fakeLoader().load);
    audio.unlock();
    await settle();
    audio.play("uiTap");
    expect(fake.heard.played).toEqual([]);
    allowed = true;
    audio.unlock();
    await settle();
    // Only what is asked for from now on: nothing was saved up while it was suspended.
    expect(fake.heard.played).toEqual([]);
    audio.play("uiTap");
    expect(fake.heard.played).toEqual(["sounds/tap.ogg"]);
  });

  it("sets the volume from 0 to 100, also when set before unlock", async () => {
    const fake = fakeContext();
    const audio = webAudio(MANIFEST, fake.make, fakeLoader().load);
    audio.setVolume(40);
    audio.unlock();
    expect(fake.volume.value).toBe(0.4);
    audio.setVolume(100);
    expect(fake.volume.value).toBe(1);
    audio.setVolume(250);
    expect(fake.volume.value).toBe(1);
    audio.setVolume(-5);
    expect(fake.volume.value).toBe(0);
    audio.setVolume(Number.NaN);
    expect(fake.volume.value).toBe(0);
  });

  it("when muted, play does nothing and what is already sounding goes quiet; unmuting restores the volume", async () => {
    const { audio, heard, volume } = await ready();
    audio.setVolume(60);
    audio.setMuted(true);
    audio.play("uiTap");
    expect(heard.played).toEqual([]);
    expect(volume.value).toBe(0);
    audio.setMuted(false);
    audio.play("uiTap");
    expect(heard.played).toEqual(["sounds/tap.ogg"]);
    expect(volume.value).toBe(0.6);
  });

  it("keeps one broken file silent and still plays the others", async () => {
    const { audio, heard } = await ready(MANIFEST, ["sounds/tap.ogg"]);
    audio.play("uiTap");
    audio.play("reveal");
    expect(heard.played).toEqual(["sounds/reveal.ogg"]);
  });

  it("treats a file the server does not have as silent, with the real file loader", async () => {
    vi.stubGlobal("fetch", async () => new Response("gone", { status: 404 }));
    const fake = fakeContext();
    const audio = webAudio(MANIFEST, fake.make);
    audio.unlock();
    await settle();
    audio.play("uiTap");
    expect(fake.heard.played).toEqual([]);
  });

  it("loads a file the server has, with the real file loader", async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(url));
    const fake = fakeContext();
    const audio = webAudio(MANIFEST, fake.make);
    audio.unlock();
    await settle();
    audio.play("uiTap");
    expect(fake.heard.played).toEqual(["sounds/tap.ogg"]);
  });

  it("never throws or rejects: no sound support, a refused resume, a failed decode, a failed start", async () => {
    const unsupported = webAudio(MANIFEST, () => {
      throw new ReferenceError("AudioContext is not defined");
    });
    expect(() => {
      unsupported.unlock();
      unsupported.play("uiTap");
      unsupported.setVolume(10);
      unsupported.setMuted(true);
    }).not.toThrow();

    const broken = fakeContext();
    const bad: SoundContext = {
      ...broken.context,
      state: "running",
      resume: () => Promise.reject(new Error("refused")),
      decodeAudioData: async () => "buffer",
      createBufferSource: () => {
        throw new Error("closed");
      },
    };
    const failing = webAudio(MANIFEST, () => bad, fakeLoader().load);
    failing.unlock();
    const suspended = webAudio(
      MANIFEST,
      () => ({
        ...bad,
        state: "suspended",
        resume: () => {
          throw new Error("refused at once");
        },
        decodeAudioData: () => Promise.reject(new Error("not a sound")),
      }),
      fakeLoader().load,
    );
    suspended.unlock();
    // Vitest fails the run on an unhandled rejection, so reaching the end covers "never rejects".
    await settle();
    expect(() => failing.play("uiTap")).not.toThrow();
    expect(() => suspended.play("uiTap")).not.toThrow();
  });
});

describe("silentAudio", () => {
  it("takes every call and does nothing", () => {
    const audio = silentAudio();
    expect(() => {
      audio.unlock();
      audio.play("uiTap");
      audio.setVolume(50);
      audio.setMuted(true);
    }).not.toThrow();
  });
});

describe("unlockOnGesture", () => {
  it("unlocks on a mouse press, a lifted finger and a key, and on nothing else", () => {
    const page = new EventTarget();
    let unlocks = 0;
    unlockOnGesture(page, { ...silentAudio(), unlock: () => (unlocks += 1) });
    expect(unlocks).toBe(0);
    for (const [type, total] of [
      ["pointerdown", 1],
      ["pointerup", 2],
      ["keydown", 3],
      ["pointermove", 3],
    ] as const) {
      page.dispatchEvent(new Event(type));
      expect(unlocks).toBe(total);
    }
  });
});
