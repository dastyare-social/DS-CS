import { describe, it, expect, mock } from "bun:test";
import { Window } from "happy-dom";

const init = mock();
mock.module("posthog-js", () => ({
  default: { init, startSessionRecording: mock() },
}));

describe("initPostHog", () => {
  it("injects PostHog's lazy-loaded scripts into <head>, not among body content", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";

    const win = new Window({ url: "https://cs.example.com/" });
    globalThis.window = win as unknown as typeof globalThis.window;
    globalThis.document = win.document as unknown as typeof globalThis.document;
    Object.defineProperty(globalThis.document, "readyState", {
      value: "complete",
      configurable: true,
    });

    const { initPostHog } = await import("../client");
    await initPostHog();

    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][1]).toMatchObject({
      external_scripts_inject_target: "head",
    });
  });
});
