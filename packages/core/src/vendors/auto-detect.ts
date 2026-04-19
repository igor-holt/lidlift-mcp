import type { Vendor } from "../types";
import { normalizeVendor } from "../discovery";

const USER_AGENT_HINTS: Array<{ pattern: RegExp; vendor: Vendor }> = [
  { pattern: /\bopenai\b|\bgpt\b/i, vendor: "openai" },
  { pattern: /\banthropic\b|\bclaude\b/i, vendor: "anthropic" },
  { pattern: /\bxai\b|\bgrok\b/i, vendor: "xai" },
  { pattern: /\bgemini\b|\bgoogle(?:\s*ai)?\b/i, vendor: "gemini" },
];

function normalizeHint(value: string | null) {
  if (!value?.trim()) {
    return null;
  }

  try {
    return normalizeVendor(value);
  } catch {
    return null;
  }
}

function detectFromAuthorization(authorization: string | null): Vendor | null {
  if (!authorization?.trim()) {
    return null;
  }

  const token = authorization.replace(/^bearer\s+/i, "").trim();

  if (!token) {
    return null;
  }

  if (/^sk-ant-/i.test(token)) {
    return "anthropic";
  }

  if (/^xai[-_]/i.test(token) || /^grok[-_]/i.test(token)) {
    return "xai";
  }

  if (/^AIza[0-9A-Za-z\-_]+$/.test(token) || /^ya29\./.test(token)) {
    return "gemini";
  }

  if (/^sk-(proj-|live-|test-|[A-Za-z0-9])+/i.test(token)) {
    return "openai";
  }

  return null;
}

function detectFromHeaders(headers: Headers): Vendor | null {
  const explicitHint =
    normalizeHint(headers.get("x-vendor")) ??
    normalizeHint(headers.get("x-ai-vendor")) ??
    normalizeHint(headers.get("vendor"));

  if (explicitHint) {
    return explicitHint;
  }

  if (headers.has("anthropic-version") || headers.has("x-anthropic-api-key")) {
    return "anthropic";
  }

  if (headers.has("openai-organization") || headers.has("openai-project")) {
    return "openai";
  }

  if (headers.has("x-goog-api-key") || headers.has("x-goog-api-client")) {
    return "gemini";
  }

  return detectFromAuthorization(headers.get("authorization"));
}

export function autoDetectVendor(request: Request): Vendor | null {
  const fromHeaders = detectFromHeaders(request.headers);

  if (fromHeaders) {
    return fromHeaders;
  }

  const userAgent = request.headers.get("user-agent");

  if (!userAgent?.trim()) {
    return null;
  }

  for (const entry of USER_AGENT_HINTS) {
    if (entry.pattern.test(userAgent)) {
      return entry.vendor;
    }
  }

  return null;
}
