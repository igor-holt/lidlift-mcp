export interface SyncOverviewInput {
  cycleId: string | null;
  healthStatus: string;
  herodotusStatus: string;
  proofVerified: boolean | null;
  expectedDeltaEth: number | null;
  operatorEmail: string | null;
  capturedAt: string;
}

export interface SyncBriefInput {
  cycleId: string | null;
  summary: string;
  model: string;
  operatorEmail: string | null;
  capturedAt: string;
}

export interface SessionState {
  lastCycleId: string | null;
  lastHealthStatus: string;
  lastHerodotusStatus: string;
  lastProofVerified: boolean | null;
  lastExpectedDeltaEth: number | null;
  lastSummary: string;
  lastSummaryModel: string | null;
  operatorEmail: string | null;
  lastUpdatedAt: string | null;
}

export const initialSessionState: SessionState = {
  lastCycleId: null,
  lastHealthStatus: "unknown",
  lastHerodotusStatus: "unknown",
  lastProofVerified: null,
  lastExpectedDeltaEth: null,
  lastSummary: "",
  lastSummaryModel: null,
  operatorEmail: null,
  lastUpdatedAt: null,
};

export function buildSessionDigest(state: SessionState): string {
  const delta =
    typeof state.lastExpectedDeltaEth === "number" ? state.lastExpectedDeltaEth.toFixed(8) : "unknown";
  return [
    `cycle=${state.lastCycleId ?? "none"}`,
    `health=${state.lastHealthStatus}`,
    `herodotus=${state.lastHerodotusStatus}`,
    `proof=${state.lastProofVerified === null ? "unknown" : String(state.lastProofVerified)}`,
    `delta=${delta}`,
    `updated=${state.lastUpdatedAt ?? "unknown"}`,
  ].join(" | ");
}
