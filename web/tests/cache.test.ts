import { describe, expect, it } from "vitest";

import { buildBriefCacheKey, buildEvidenceCacheKey, isCacheFresh } from "../netlify/functions/lib/cache";

describe("cache helpers", () => {
  it("creates deterministic keys", () => {
    expect(buildEvidenceCacheKey("cycle-42")).toBe("evidence/cycle-42.json");
    expect(buildBriefCacheKey("cycle-42")).toBe("briefs/cycle-42.json");
    expect(buildBriefCacheKey(null)).toBe("briefs/latest.json");
  });

  it("detects stale cache entries", () => {
    const now = Date.parse("2026-04-12T12:00:30.000Z");
    expect(isCacheFresh("2026-04-12T12:00:00.000Z", 60, now)).toBe(true);
    expect(isCacheFresh("2026-04-12T12:00:00.000Z", 10, now)).toBe(false);
  });
});
