import { describe, expect, it } from "vitest";

import { buildFallbackBrief } from "../netlify/functions/lib/prompts";

describe("fallback operator brief", () => {
  it("stays proof-first and includes the key signals", () => {
    const brief = buildFallbackBrief(
      {
        health: { status: "guarded", issues: ["Proof verification pending"] },
        latest_quote: { expected_delta_eth: 0.01234567 },
        latest_cycle_id: "cycle-77",
        herodotus: {
          summary: "Satellite resolved and indexer candidate planned.",
        },
      },
      null,
      "cycle-77",
    );

    expect(brief).toContain("Health: guarded.");
    expect(brief).toContain("Expected delta: 0.01234567 ETH.");
    expect(brief).toContain("Herodotus: Satellite resolved and indexer candidate planned.");
    expect(brief).toContain("deterministic fallback summary");
  });
});
