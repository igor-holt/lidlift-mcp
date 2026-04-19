import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  discoverVendorTools,
  discoverVendorToolsResponse,
  mergeToolCatalogs,
  normalizeVendor,
  resetVendorDiscoveryCache,
  type DiscoveryCacheAdapter,
  type DiscoveryCacheEntry,
} from "../../index";

const originalFetch = globalThis.fetch;

function createMemoryCache() {
  const store = new Map<string, DiscoveryCacheEntry>();

  const cache: DiscoveryCacheAdapter = {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
  };

  return { cache, store };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-18T12:00:00.000Z"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetVendorDiscoveryCache();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("normalizeVendor", () => {
  it("normalizes common aliases", () => {
    expect(normalizeVendor("Claude")).toBe("anthropic");
    expect(normalizeVendor("grok")).toBe("xai");
    expect(normalizeVendor("google")).toBe("gemini");
  });
});

describe("discoverVendorTools cache behavior", () => {
  it("reuses cached discovery results until the TTL expires", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ id: "gpt-5" }), { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const first = await discoverVendorToolsResponse("openai", {
      apiKey: "sk-cache",
      cacheTtlMs: 50,
      model: "gpt-5",
    });
    const second = await discoverVendorToolsResponse("openai", {
      apiKey: "sk-cache",
      cacheTtlMs: 50,
      model: "gpt-5",
    });

    vi.advanceTimersByTime(60);

    const third = await discoverVendorToolsResponse("openai", {
      apiKey: "sk-cache",
      cacheTtlMs: 50,
      model: "gpt-5",
    });

    expect(first.ok && first.cached).toBe(false);
    expect(second.ok && second.cached).toBe(true);
    expect(third.ok && third.cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bypasses cache when forceRefresh is true", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ id: "gpt-5" }), { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await discoverVendorToolsResponse("openai", {
      apiKey: "sk-force",
      model: "gpt-5",
    });
    const refreshed = await discoverVendorToolsResponse("openai", {
      apiKey: "sk-force",
      forceRefresh: true,
      model: "gpt-5",
    });

    expect(refreshed.ok && refreshed.cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("supports a custom cache adapter for production runtimes", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ id: "gpt-5" }), { status: 200 });
    });
    const { cache, store } = createMemoryCache();
    globalThis.fetch = fetchMock as typeof fetch;

    await discoverVendorTools("openai", {
      apiKey: "sk-kv",
      cache,
      model: "gpt-5",
    });
    await discoverVendorTools("openai", {
      apiKey: "sk-kv",
      cache,
      model: "gpt-5",
    });

    expect(store.size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("discoverVendorTools error handling", () => {
  it("returns structured auth errors without exposing tokens", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: "Bearer sk-secret-do-not-log is invalid",
          },
        }),
        { status: 401 },
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await discoverVendorToolsResponse("openai", {
      apiKey: "sk-secret-do-not-log",
      model: "gpt-5",
    });

    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error("Expected discovery to fail.");
    }

    expect(response.error.code).toBe("ERR_AUTH");
    expect(response.error.message).not.toContain("sk-secret-do-not-log");
  });

  it("returns structured rate-limit errors", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: "too many" } }), {
        headers: {
          "retry-after": "9",
        },
        status: 429,
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await discoverVendorToolsResponse("openai", {
      apiKey: "sk-limit",
      model: "gpt-5",
    });

    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error("Expected discovery to fail.");
    }

    expect(response.error).toMatchObject({
      code: "ERR_RATE_LIMIT",
      retryAfterSeconds: 9,
    });
  });

  it("returns vendor errors for unsupported providers", async () => {
    const response = await discoverVendorToolsResponse("unsupported");

    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error("Expected discovery to fail.");
    }

    expect(response.error.code).toBe("ERR_VENDOR");
    expect(response.vendor).toBeNull();
  });
});

describe("mergeToolCatalogs", () => {
  it("prefers later tool entries when merging by name", () => {
    const merged = mergeToolCatalogs(
      [
        {
          name: "web_search",
          description: "default description",
        },
      ],
      [
        {
          name: "web_search",
          description: "custom description",
          capabilities: ["custom"],
        },
      ],
    );

    expect(merged).toEqual([
      {
        name: "web_search",
        description: "custom description",
        capabilities: ["custom"],
      },
    ]);
  });
});
