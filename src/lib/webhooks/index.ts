import { createHmac, randomBytes, randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema/webhooks";

export const WEBHOOK_EVENTS = [
  "post.created",
  "post.updated",
  "post.deleted",
  "post.reacted",
  "post.viewed",
  "story.created",
  "story.updated",
  "story.deleted",
  "story.viewed",
  "story.liked",
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 2_000, 4_000];

export function newWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

function signPayload(secret: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findActiveHooks(event: WebhookEventName) {
  return db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.active, true),
        sql`${event} = ANY(${webhooks.events})`,
      ),
    );
}

async function persistOutcome(
  id: string,
  status: string,
  failure: boolean,
): Promise<void> {
  const now = new Date();
  if (failure) {
    await db
      .update(webhooks)
      .set({
        lastStatus: status,
        lastAttemptAt: now,
        failureCount: sql`${webhooks.failureCount} + 1`,
      })
      .where(eq(webhooks.id, id));
  } else {
    await db
      .update(webhooks)
      .set({
        lastStatus: status,
        lastAttemptAt: now,
        failureCount: 0,
      })
      .where(eq(webhooks.id, id));
  }
}

function failureStatus(
  statusCode: number | null,
  error: unknown,
): string {
  if (statusCode !== null) return `HTTP ${statusCode}`;
  if (error instanceof Error && error.name === "AbortError") return "timeout";
  return "error";
}

async function deliver(
  hook: typeof webhooks.$inferSelect,
  body: string,
): Promise<void> {
  let lastError: unknown = null;
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Dastyare-Social-Webhook/1.0",
          "x-ds-webhook-signature": signPayload(hook.secret, body),
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.ok) {
        await persistOutcome(hook.id, "ok", false);
        return;
      }

      lastStatus = res.status;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timeout);
    }
  }

  await persistOutcome(
    hook.id,
    failureStatus(lastStatus, lastError),
    true,
  );
}

async function runDeliveries(
  event: WebhookEventName,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const hooks = await findActiveHooks(event);
    if (hooks.length === 0) return;

    const body = JSON.stringify({
      id: randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    await Promise.allSettled(hooks.map((hook) => deliver(hook, body)));
  } catch (err) {
    console.error(`[webhooks] emit ${event} failed`, err);
  }
}

export function emitWebhookEvent(
  event: WebhookEventName,
  data: Record<string, unknown>,
): void {
  const task = () => runDeliveries(event, data);
  try {
    after(task);
  } catch {
    void task();
  }
}