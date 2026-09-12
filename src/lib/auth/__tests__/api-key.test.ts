import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import type { NextRequest } from "next/server";
import { requireApiKeyAuth, getApiKeyRateLimitState } from "../api-key";

const makeReq = (pathname = "/api/posts", headers?: HeadersInit): NextRequest =>
  ({ headers: new Headers(headers), nextUrl: { pathname } }) as unknown as NextRequest;

describe("requireApiKeyAuth", () => {
  const originalApiKey = process.env.API_KEY;
  const originalMax = process.env.API_KEY_RATE_LIMIT_MAX_REQUESTS;
  const originalWindow = process.env.API_KEY_RATE_LIMIT_WINDOW_MS;

  beforeEach(() => {
    process.env.API_KEY = "shared-secret";
    process.env.API_KEY_RATE_LIMIT_MAX_REQUESTS = "2";
    process.env.API_KEY_RATE_LIMIT_WINDOW_MS = "10000";
    getApiKeyRateLimitState().clear();
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalApiKey;

    if (originalMax === undefined) delete process.env.API_KEY_RATE_LIMIT_MAX_REQUESTS;
    else process.env.API_KEY_RATE_LIMIT_MAX_REQUESTS = originalMax;

    if (originalWindow === undefined) delete process.env.API_KEY_RATE_LIMIT_WINDOW_MS;
    else process.env.API_KEY_RATE_LIMIT_WINDOW_MS = originalWindow;

    getApiKeyRateLimitState().clear();
  });

  it("rejects requests without a bearer token", () => {
    const req = makeReq();

    const result = requireApiKeyAuth(req);

    expect(result).not.toBe(null);
    expect(result?.status).toBe(401);
  });

  it("accepts the configured bearer token", () => {
    const req = makeReq("/api/posts", {
      authorization: "Bearer shared-secret",
    });

    const result = requireApiKeyAuth(req);

    expect(result).toBe(null);
  });

  it("rate limits repeated requests from the same client", () => {
    const req1 = makeReq("/api/posts", {
      authorization: "Bearer shared-secret",
    });
    const req2 = makeReq("/api/posts", {
      authorization: "Bearer shared-secret",
    });
    const req3 = makeReq("/api/posts", {
      authorization: "Bearer shared-secret",
    });

    expect(requireApiKeyAuth(req1)).toBe(null);
    expect(requireApiKeyAuth(req2)).toBe(null);
    const blocked = requireApiKeyAuth(req3);

    expect(blocked).not.toBe(null);
    expect(blocked?.status).toBe(429);
  });
});
