import { describe, expect, it } from "vitest";

import { autoDetectVendor } from "../../index";

describe("autoDetectVendor", () => {
  it("prefers explicit X-Vendor hints", () => {
    const request = new Request("https://example.com/discover-tools", {
      headers: {
        "x-vendor": "Claude",
        "user-agent": "OpenAI CLI",
      },
    });

    expect(autoDetectVendor(request)).toBe("anthropic");
  });

  it("detects vendors from provider-specific headers", () => {
    const geminiRequest = new Request("https://example.com/discover-tools", {
      headers: {
        "x-goog-api-key": "AIzaSyExample",
      },
    });
    const openAiRequest = new Request("https://example.com/discover-tools", {
      headers: {
        "openai-project": "proj_test",
      },
    });

    expect(autoDetectVendor(geminiRequest)).toBe("gemini");
    expect(autoDetectVendor(openAiRequest)).toBe("openai");
  });

  it("detects vendors from bearer token patterns", () => {
    const anthropicRequest = new Request("https://example.com/discover-tools", {
      headers: {
        authorization: "Bearer sk-ant-test-token",
      },
    });
    const xaiRequest = new Request("https://example.com/discover-tools", {
      headers: {
        authorization: "Bearer xai-test-token",
      },
    });

    expect(autoDetectVendor(anthropicRequest)).toBe("anthropic");
    expect(autoDetectVendor(xaiRequest)).toBe("xai");
  });

  it("falls back to user-agent detection", () => {
    const request = new Request("https://example.com/discover-tools", {
      headers: {
        "user-agent": "Gemini SDK/1.2.3",
      },
    });

    expect(autoDetectVendor(request)).toBe("gemini");
  });

  it("returns null when no vendor signal exists", () => {
    const request = new Request("https://example.com/discover-tools");

    expect(autoDetectVendor(request)).toBeNull();
  });
});
