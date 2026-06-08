import { Agent, routeAgentRequest, unstable_callable } from "agents";

import { buildSessionDigest, initialSessionState, type SessionState, type SyncBriefInput, type SyncOverviewInput } from "./shared";

type Env = {
  ProofSessionAgent: unknown;
};

export class ProofSessionAgent extends Agent<Env, SessionState> {
  initialState: SessionState = initialSessionState;

  @unstable_callable()
  syncOverview(input: SyncOverviewInput): SessionState {
    const nextState: SessionState = {
      ...this.state,
      lastCycleId: input.cycleId,
      lastHealthStatus: input.healthStatus,
      lastHerodotusStatus: input.herodotusStatus,
      lastProofVerified: input.proofVerified,
      lastExpectedDeltaEth: input.expectedDeltaEth,
      operatorEmail: input.operatorEmail,
      lastUpdatedAt: input.capturedAt,
    };
    this.setState(nextState);
    return nextState;
  }

  @unstable_callable()
  syncBrief(input: SyncBriefInput): SessionState {
    const nextState: SessionState = {
      ...this.state,
      lastCycleId: input.cycleId,
      lastSummary: input.summary,
      lastSummaryModel: input.model,
      operatorEmail: input.operatorEmail,
      lastUpdatedAt: input.capturedAt,
    };
    this.setState(nextState);
    return nextState;
  }

  @unstable_callable()
  getSessionSummary(): { digest: string; state: SessionState } {
    return {
      digest: buildSessionDigest(this.state as SessionState),
      state: this.state as SessionState,
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  },
};
