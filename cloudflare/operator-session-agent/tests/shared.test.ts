import { describe, expect, it } from "vitest";

import { buildSessionDigest, initialSessionState } from "../src/shared";

describe("session digest", () => {
  it("renders a stable operator summary", () => {
    const digest = buildSessionDigest({
      ...initialSessionState,
      lastCycleId: "cycle-9",
      lastHealthStatus: "guarded",
      lastHerodotusStatus: "ready",
      lastProofVerified: true,
      lastExpectedDeltaEth: 0.00987654,
      lastUpdatedAt: "2026-04-12T12:00:00.000Z",
    });

    expect(digest).toContain("cycle=cycle-9");
    expect(digest).toContain("health=guarded");
    expect(digest).toContain("herodotus=ready");
    expect(digest).toContain("delta=0.00987654");
  });
});
