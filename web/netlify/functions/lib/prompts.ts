import type { OverviewPayload } from "../../../src/types";

function formatDelta(delta: number | undefined): string {
  return typeof delta === "number" ? `${delta.toFixed(8)} ETH` : "unknown";
}

export function buildFallbackBrief(overview: OverviewPayload, evidence: unknown, cycleId: string | null): string {
  const health = overview.health?.status ?? "unknown";
  const delta = formatDelta(overview.latest_quote?.expected_delta_eth);
  const herodotus = overview.herodotus?.summary ?? "Herodotus summary unavailable.";
  const issues = overview.health?.issues?.length ? overview.health.issues.join("; ") : "No active issues.";
  const evidenceNote = evidence ? "Evidence bundle loaded for operator review." : "No evidence bundle loaded.";
  return [
    `Health: ${health}.`,
    `Expected delta: ${delta}.`,
    `Latest cycle: ${cycleId ?? overview.latest_cycle_id ?? "none"}.`,
    `Herodotus: ${herodotus}`,
    `Issues: ${issues}`,
    evidenceNote,
    "This is a deterministic fallback summary because AI Gateway credentials were not available in the current runtime.",
  ].join(" ");
}

export function buildOperatorBriefPrompt(overview: OverviewPayload, evidence: unknown, cycleId: string | null): string {
  return `
You are producing a proof-first operator brief for a read-only ETH console.
Do not claim profitability, execution authority, or validated treasury growth.
Summarize only what the payload supports.

Return exactly four bullets:
- Health and policy posture
- Latest quote and expected delta
- Herodotus readiness and proof posture
- Immediate operator attention item

Overview:
${JSON.stringify(overview, null, 2)}

Cycle ID:
${cycleId ?? "none"}

Evidence:
${JSON.stringify(evidence, null, 2)}
`.trim();
}
