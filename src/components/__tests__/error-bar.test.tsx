import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Window } from "happy-dom";
import React from "react";

import ErrorBar from "@/components/error-bar";
import { raiseError, ERROR_BAR_EVENT } from "@/lib/error-bar";

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as any;
  globalThis.document = window.document as any;
  globalThis.navigator = window.navigator as any;
  document.body.innerHTML = "";

  // happy-dom ships no ResizeObserver; the bar only needs observe/disconnect.
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// `screen` binds `document.body` at import time, which is before `beforeEach`
// installs happy-dom — so every query goes through the render result instead.
const renderBar = () => {
  const { queryByRole } = render(<ErrorBar />);
  return () => queryByRole("alert");
};

describe("raiseError", () => {
  const collect = () => {
    const seen: string[] = [];
    const onRaise = (e: Event) =>
      seen.push((e as CustomEvent<{ message: string }>).detail.message);
    window.addEventListener(ERROR_BAR_EVENT, onRaise);
    return { seen, stop: () => window.removeEventListener(ERROR_BAR_EVENT, onRaise) };
  };

  it("normalizes an Error, a string and an arbitrary throw", () => {
    const { seen, stop } = collect();

    raiseError(new Error("Upload failed: 500"));
    raiseError("Network error");
    raiseError({ code: 42 }, "Something went wrong");

    stop();
    expect(seen).toEqual([
      "Upload failed: 500",
      "Network error",
      "Something went wrong",
    ]);
  });

  it("ignores null, undefined and blank messages", () => {
    const { seen, stop } = collect();

    raiseError(null);
    raiseError(undefined);
    raiseError("");
    raiseError("   ");

    stop();
    expect(seen).toEqual([]);
  });
});

describe("ErrorBar", () => {
  it("stays hidden until an error is raised", () => {
    const query = renderBar();
    expect(query()).toBeNull();
  });

  it("shows the raised message and auto-dismisses after the delay", () => {
    vi.useFakeTimers();
    const query = renderBar();

    act(() => raiseError("Couldn't save"));
    expect(query()?.textContent).toContain("Couldn't save");

    act(() => vi.advanceTimersByTime(4000));
    expect(query()).toBeNull();
  });

  it("honours a per-message duration override", () => {
    vi.useFakeTimers();
    const query = renderBar();

    act(() => raiseError("Sticky", "fallback", 10_000));
    act(() => vi.advanceTimersByTime(4000));
    expect(query()).not.toBeNull();

    act(() => vi.advanceTimersByTime(6000));
    expect(query()).toBeNull();
  });

  it("replaces the message and restarts the timer when a different one arrives", () => {
    vi.useFakeTimers();
    const query = renderBar();

    act(() => raiseError("First"));
    act(() => vi.advanceTimersByTime(3000));
    act(() => raiseError("Second"));

    expect(query()?.textContent).toContain("Second");
    // Would already have expired on the first timer.
    act(() => vi.advanceTimersByTime(3000));
    expect(query()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(query()).toBeNull();
  });

  it("dedupes repeats so a flapping error cannot hold the bar open", () => {
    vi.useFakeTimers();
    const query = renderBar();

    act(() => raiseError("Same"));
    act(() => vi.advanceTimersByTime(3000));
    // Same message again — ignored, so the original timer is left alone.
    act(() => raiseError("Same"));
    act(() => vi.advanceTimersByTime(1000));
    expect(query()).toBeNull();
  });

  it("dismisses early when the X is pressed, and leaves no timer behind", () => {
    vi.useFakeTimers();
    const query = renderBar();

    act(() => raiseError("Dismiss me"));
    expect(query()).not.toBeNull();

    act(() => fireEvent.click(query()!.querySelector("svg")!));
    expect(query()).toBeNull();

    act(() => vi.advanceTimersByTime(4000));
    expect(query()).toBeNull();
  });

  it("resets --error-bar-height when it hides", () => {
    vi.useFakeTimers();
    const query = renderBar();

    act(() => raiseError("Measures me"));
    expect(query()).not.toBeNull();

    act(() => vi.advanceTimersByTime(4000));
    expect(query()).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue("--error-bar-height"),
    ).toBe("0px");
  });
});
