import type { PushStatus } from "./status";
import { captureClientEvent } from "@/lib/analytics/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const output = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }

  return output;
}

export async function registerPushSubscription(): Promise<PushStatus | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return "unsupported-browser";
  }

  if (!process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY) {
    return "missing-vapid";
  }

  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    return "error";
  }

  const swRegistration = await navigator.serviceWorker.ready;
  if (!swRegistration.pushManager) {
    return "unsupported-browser";
  }

  const existingPermission = Notification.permission;
  if (existingPermission === "denied") {
    return "permission-denied";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "permission-denied";
  }

  const subscription = await swRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY),
  });

  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    console.error("Push subscription save failed", await response.text());
    void captureClientEvent("push_subscription_failed", {
      status: response.status,
      ok: false,
    });
    return "error";
  }

  void captureClientEvent("push_subscription_enabled", {
    endpoint: subscription.endpoint,
  });

  return "enabled";
}
