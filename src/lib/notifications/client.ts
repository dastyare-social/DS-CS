import type { PushStatus } from "./status";
import { captureClientEvent } from "@/lib/analytics/client";
import { isRunningAsPWA } from "@/lib/utils/pwa";

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

/**
 * Checks if the current browser has an active push subscription
 * @returns Promise<boolean> indicating if subscription exists and is active
 */
export async function checkPushSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const swRegistration = await navigator.serviceWorker.ready;
    if (!swRegistration.pushManager) {
      return false;
    }

    const subscription = await swRegistration.pushManager.getSubscription();
    if (!subscription) {
      return false;
    }

    // Also check with our backend to ensure it's recorded as active
    const response = await fetch(`/api/push/check?endpoint=${encodeURIComponent(subscription.endpoint)}`);
    if (response.ok) {
      const data = await response.json();
      return data.active === true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 * @returns Promise<boolean> indicating success
 */
export async function unregisterPushSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const swRegistration = await navigator.serviceWorker.ready;
    if (!swRegistration.pushManager) {
      return false;
    }

    const subscription = await swRegistration.pushManager.getSubscription();
    if (!subscription) {
      return true; // Already unsubscribed
    }

    // Unsubscribe from push service
    const success = await subscription.unsubscribe();
    if (!success) {
      console.warn("Failed to unsubscribe from push service");
    }

    // Notify backend about unsubscribe
    const response = await fetch(`/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    if (response.ok) {
      void captureClientEvent("push_subscription_disabled", {
        endpoint: subscription.endpoint,
      });
    }

    return success;
  } catch (error) {
    console.error("Failed to unsubscribe from push notifications:", error);
    return false;
  }
}

/**
 * Toggle push subscription - subscribe if not subscribed, unsubscribe if subscribed
 * @returns Promise<PushStatus | null> indicating the new status
 */
export async function togglePushSubscription(): Promise<PushStatus | null> {
  const isSubscribed = await checkPushSubscription();
  
  if (isSubscribed) {
    const success = await unregisterPushSubscription();
    return success ? "idle" : "error";
  } else {
    return await registerPushSubscription();
  }
}

export async function registerPushSubscription(): Promise<PushStatus | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return "unsupported-browser";
  }

  // Check if running as PWA - notifications work better in PWA mode
  if (!isRunningAsPWA()) {
    return "not-pwa";
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