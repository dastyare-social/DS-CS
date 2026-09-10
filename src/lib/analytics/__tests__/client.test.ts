import { describe, it, expect, beforeEach } from "bun:test";
import { Window } from "happy-dom";
import { whenDocumentReady } from "../client";

// whenDocumentReady gates PostHog init until after the document loads, so its
// injected <script> tags never land in the body while React is still hydrating
// (which breaks hydration — React error #418).
describe("whenDocumentReady", () => {
  let win: Window;

  beforeEach(() => {
    win = new Window();
    globalThis.window = win as unknown as typeof globalThis.window;
    globalThis.document = win.document as unknown as typeof globalThis.document;
  });

  it("waits for the load event while the document is still loading", async () => {
    Object.defineProperty(globalThis.document, "readyState", {
      value: "loading",
      configurable: true,
    });

    let resolved = false;
    void whenDocumentReady().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    globalThis.window.dispatchEvent(new win.Event("load"));
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it("resolves immediately once the document has finished loading", async () => {
    Object.defineProperty(globalThis.document, "readyState", {
      value: "complete",
      configurable: true,
    });

    await expect(whenDocumentReady()).resolves.toBeUndefined();
  });
});
