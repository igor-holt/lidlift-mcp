import { afterEach, describe, expect, it, vi } from "vitest";

import {
  STATIC_BUILT_INS,
  vendorAdapterRegistry,
  type DiscoveryContext,
} from "../../index";

const originalFetch = globalThis.fetch;

function baseContext(model: string, apiKey?: string): DiscoveryContext {
  return {
    apiKey,
    model,
    options: {},
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("vendorAdapterRegistry", () => {
  it("keeps the OpenAI adapter on live validation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "https://api.openai.com/v1/models/gpt-5") {
        return new Response(JSON.stringify({ id: "gpt-5" }), { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const tools = await vendorAdapterRegistry.openai.discover(
      baseContext("gpt-5", "sk-openai"),
    );

    expect(tools.map((tool) => tool.name)).toContain("web_search");
    expect(tools.map((tool) => tool.name)).toContain("code_interpreter");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns Anthropic static built-ins when no live credentials are provided", async () => {
    const tools = await vendorAdapterRegistry.anthropic.discover(
      baseContext("claude-sonnet-4-5"),
    );

    expect(tools).toEqual(STATIC_BUILT_INS.anthropic);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["web_search", "code_execution", "bash"]),
    );
  });

  it("falls back to xAI static built-ins when live discovery is unavailable", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: "down" } }), {
        status: 500,
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const tools = await vendorAdapterRegistry.xai.discover(
      baseContext("grok-4.20-reasoning", "xai-test"),
    );

    expect(tools).toEqual(STATIC_BUILT_INS.xai);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["web_search", "x_search", "code_interpreter"]),
    );
  });

  it("returns Gemini static built-ins without live discovery", async () => {
    const tools = await vendorAdapterRegistry.gemini.discover(
      baseContext("gemini-2.5-flash"),
    );

    expect(tools).toEqual(STATIC_BUILT_INS.gemini);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["google_search", "code_execution"]),
    );
  });
});
