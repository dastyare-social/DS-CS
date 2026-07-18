import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema/push-subscriptions";
import { eq } from "drizzle-orm";
import webPush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export function buildPushNotificationPayload(payload: PushPayload) {
  return {
    title: payload.title,
    body: payload.body,
    url: payload.url,
  };
}

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY;
  const privateKey = process.env.WEBPUSH_PRIVATE_KEY;
  const vapidSubject = process.env.WEBPUSH_SUBJECT;

  if (!publicKey || !privateKey || !vapidSubject) {
    return null;
  }

  webPush.setVapidDetails(vapidSubject, publicKey, privateKey);
  return { publicKey };
}

export async function sendPushNotification(payload: PushPayload) {
  const configured = configureWebPush();
  if (!configured) {
    return { success: false, skipped: true, reason: "push-not-configured" };
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.active, true));

  if (!subscriptions.length) {
    return { success: true, skipped: true, reason: "no-subscribers" };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    icon: "/profile_image.png",
  });

  const promises = subscriptions.map((subscription) =>
    webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      } as {
        endpoint: string;
        keys: {
          p256dh: string;
          auth: string;
        };
      },
      notificationPayload,
    ),
  );

  const results = await Promise.allSettled(promises);
  const failed = results.filter((result) => result.status === "rejected").length;

  return { success: true, sent: results.length - failed, failed };
}
