import type { PushStatus } from "./status";

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

  if (typeof window.PushManager === "undefined") {
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

  const existingPermission = Notification.permission;
  if (existingPermission === "denied") {
    return "permission-denied";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "permission-denied";
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY),
  });

  await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  return "enabled";
}
