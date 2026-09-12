import { createHmac } from "crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

type StoredHook = {
  id: string;
  url: string;
  secret: string;
};

type FetchCall = {
  url: string;
  init: RequestInit;
};

const dbState = {
  hooks: [] as StoredHook[],
  updates: [] as Array<{ values: Record<string, unknown> }>,
};

const dbMock = {
  select: () => ({
    from: () => ({
      where: () => Promise.resolve(dbState.hooks),
    }),
  }),
  update: (_table: unknown) => ({
    set: (values: Record<string, unknown>) => {
      dbState.updates.push({ values });
      return { where: () => Promise.resolve(undefined) };
    },
  }),
};

mock.module("@/lib/db", () => ({ db: dbMock }));
mock.module("next/server", () => ({
  after: (task: () => void) => {
    task();
  },
}));

const { emitWebhookEvent, newWebhookSecret, WEBHOOK_EVENTS } = await import(
  "@/lib/webhooks"
);

const originalFetch = globalThis.fetch;
let fetchCalls: FetchCall[] = [];
let fetchHandler: (url: string, init: RequestInit) => Promise<Response>;

function makeHook(overrides: Partial<StoredHook> = {}): StoredHook {
  return {
    id: "hook-" + Math.random().toString(36).slice(2, 10),
    url: "https://example.com/hook-" + Math.random().toString(36).slice(2, 10),
    secret: newWebhookSecret(),
    ...overrides,
  };
}

async function flush(rounds = 3) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function waitFor(cond: () => boolean, timeoutMs: number) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

beforeEach(() => {
  dbState.hooks = [];
  dbState.updates = [];
  fetchCalls = [];
  fetchHandler = () => Promise.resolve(new Response(null, { status: 200 }));
  globalThis.fetch = ((input, init) => {
    fetchCalls.push({ url: String(input), init: init ?? {} });
    return fetchHandler(String(input), init ?? {});
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("newWebhookSecret", () => {
  it("produces a 64-char lowercase hex secret, unique per call", () => {
    const a = newWebhookSecret();
    const b = newWebhookSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("WEBHOOK_EVENTS", () => {
  it("exposes the ten supported events", () => {
    expect(WEBHOOK_EVENTS).toEqual([
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
    ]);
  });
});

describe("emitWebhookEvent", () => {
  it("sends a signed JSON payload to every matching hook", async () => {
    dbState.hooks = [makeHook(), makeHook()];
    const data = { postId: "abc", title: "hello" };

    emitWebhookEvent("post.created", data);
    await flush();

    expect(fetchCalls).toHaveLength(2);
    expect(dbState.updates).toHaveLength(2);
    for (const update of dbState.updates) {
      expect(update.values.lastStatus).toBe("ok");
      expect(update.values.failureCount).toBe(0);
      expect(update.values.lastAttemptAt).toBeInstanceOf(Date);
    }
  });

  it("does nothing when no hook matches the event", async () => {
    dbState.hooks = [];

    emitWebhookEvent("post.viewed", {});
    await flush();

    expect(fetchCalls).toHaveLength(0);
    expect(dbState.updates).toHaveLength(0);
  });

  it("signs the payload with an HMAC and includes event metadata", async () => {
    const hook = makeHook();
    dbState.hooks = [hook];
    const data = { postId: "xyz" };

    emitWebhookEvent("story.created", data);
    await flush();

    expect(fetchCalls).toHaveLength(1);
    const { url, init } = fetchCalls[0];
    expect(url).toBe(hook.url);
    expect(init.method).toBe("POST");

    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["user-agent"]).toBe("Dastyare-Social-Webhook/1.0");

    const signature = headers["x-ds-webhook-signature"] ?? "";
    expect(signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    const timestamp = signature.match(/^t=(\d+),v1=/)?.[1] ?? "";
    const providedHmac = signature.match(/^t=\d+,v1=([0-9a-f]{64})$/)?.[1] ?? "";

    const body = init.body as string;
    const payload = JSON.parse(body) as {
      id: string;
      event: string;
      timestamp: string;
      data: Record<string, unknown>;
    };
    expect(payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(payload.event).toBe("story.created");
    expect(payload.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(payload.data).toEqual(data);

    const expectedHmac = createHmac("sha256", hook.secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    expect(providedHmac).toBe(expectedHmac);
  });

  it("retries up to three times with backoff and records the final failure", async () => {
    dbState.hooks = [makeHook()];
    fetchHandler = () => Promise.resolve(new Response(null, { status: 500 }));

    emitWebhookEvent("post.updated", {});
    await waitFor(() => fetchCalls.length === 3, 5000);
    await flush();

    const final = dbState.updates[dbState.updates.length - 1];
    expect(final.values.lastStatus).toBe("HTTP 500");
    expect(final.values.lastAttemptAt).toBeInstanceOf(Date);
    expect(final.values.failureCount).toBeDefined();
    expect(final.values.failureCount).not.toBe(0);
  });

  it("stops retrying and resets the failure count once a request succeeds", async () => {
    dbState.hooks = [makeHook()];
    let attempts = 0;
    fetchHandler = () => {
      attempts += 1;
      return Promise.resolve(new Response(null, { status: attempts === 1 ? 500 : 200 }));
    };

    emitWebhookEvent("post.reacted", {});
    await waitFor(() => fetchCalls.length === 2, 4000);
    await flush();

    expect(attempts).toBe(2);
    const final = dbState.updates[dbState.updates.length - 1];
    expect(final.values.lastStatus).toBe("ok");
    expect(final.values.failureCount).toBe(0);
  });

  it("marks the outcome as timeout when the request is aborted", async () => {
    dbState.hooks = [makeHook()];
    fetchHandler = () =>
      Promise.reject(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      );

    emitWebhookEvent("story.liked", {});
    await waitFor(() => fetchCalls.length === 3, 5000);
    await flush();

    expect(fetchCalls[0].init.signal).toBeInstanceOf(AbortSignal);
    const final = dbState.updates[dbState.updates.length - 1];
    expect(final.values.lastStatus).toBe("timeout");
    expect(final.values.lastAttemptAt).toBeInstanceOf(Date);
    expect(final.values.failureCount).toBeDefined();
    expect(final.values.failureCount).not.toBe(0);
  });
});