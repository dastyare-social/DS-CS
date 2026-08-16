import { describe, expect, it } from "vitest";
import { buildPushNotificationPayload } from "./push";
import { getPushStatusMessage } from "./status";

describe("buildPushNotificationPayload", () => {
  it("creates a payload with the expected title, body, and url", () => {
    const payload = buildPushNotificationPayload({
      title: "New post",
      body: "A new post was published",
      url: "/posts",
    });

    expect(payload).toMatchObject({
      title: "New post",
      body: "A new post was published",
      url: "/posts",
    });
  });
});

describe("getPushStatusMessage", () => {
  it("returns a helpful message for unsupported browsers", () => {
    expect(getPushStatusMessage("unsupported-browser")).toContain("not supported");
  });

  it("returns a helpful message for missing VAPID configuration", () => {
    expect(getPushStatusMessage("missing-vapid")).toContain("VAPID");
  });

  it("returns a helpful message for the idle state", () => {
    expect(getPushStatusMessage("idle")).toContain("browser notifications");
  });
});
