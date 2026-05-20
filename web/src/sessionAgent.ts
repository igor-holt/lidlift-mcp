import { AgentClient } from "agents/client";

import type { AgentSessionSummary, OperatorBriefPayload, OverviewPayload } from "./types";

const AGENT_NAME = "proof-session-agent";
const INSTANCE_NAME = "operator-deck";

export class SessionAgentBridge {
  private readonly client: AgentClient;

  constructor(origin: string) {
    const target = new URL(origin);
    this.client = new AgentClient({
      host: target.host,
      protocol: target.protocol === "https:" ? "wss" : "ws",
      agent: AGENT_NAME,
      name: INSTANCE_NAME,
    });
  }

  async syncOverview(overview: OverviewPayload, operatorEmail: string | null): Promise<AgentSessionSummary> {
    await this.client.call("syncOverview", [
      {
        cycleId: overview.latest_cycle_id ?? null,
        healthStatus: overview.health?.status ?? "unknown",
        herodotusStatus: overview.herodotus?.status ?? "unknown",
        proofVerified: overview.latest_proof?.verified ?? null,
        expectedDeltaEth: overview.latest_quote?.expected_delta_eth ?? null,
        operatorEmail,
        capturedAt: new Date().toISOString(),
      },
    ]);
    return this.getSessionSummary();
  }

  async syncBrief(brief: OperatorBriefPayload, operatorEmail: string | null): Promise<AgentSessionSummary> {
    await this.client.call("syncBrief", [
      {
        cycleId: brief.cycle_id,
        summary: brief.summary,
        model: brief.model,
        operatorEmail,
        capturedAt: brief.generated_at,
      },
    ]);
    return this.getSessionSummary();
  }

  async getSessionSummary(): Promise<AgentSessionSummary> {
    return this.client.call<AgentSessionSummary>("getSessionSummary");
  }
}

export function createSessionAgentBridge(): SessionAgentBridge | null {
  const origin = import.meta.env.VITE_CF_AGENT_HOST;
  if (!origin) {
    return null;
  }

  try {
    return new SessionAgentBridge(origin);
  } catch {
    return null;
  }
}
