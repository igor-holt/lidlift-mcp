import type {
  BalancePayload,
  EvidencePayload,
  OperatorBriefPayload,
  OverviewPayload,
  SessionPayload,
} from "./types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.error || payload?.detail || `Request failed with status ${response.status}`;
    throw new Error(detail);
  }
  return payload as T;
}

export async function fetchOverview(): Promise<OverviewPayload> {
  return fetchJson<OverviewPayload>("/api/proof-first/overview");
}

export async function fetchEvidence(cycleId: string): Promise<EvidencePayload> {
  const params = new URLSearchParams({ cycleId });
  return fetchJson<EvidencePayload>(`/api/proof-first/evidence?${params.toString()}`);
}

export async function fetchBalance(token: string): Promise<BalancePayload> {
  return fetchJson<BalancePayload>("/api/balance", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchOperatorBrief(cycleId?: string): Promise<OperatorBriefPayload> {
  const params = new URLSearchParams();
  if (cycleId) {
    params.set("cycleId", cycleId);
  }
  return fetchJson<OperatorBriefPayload>(`/api/operator/brief?${params.toString()}`);
}

export async function fetchSession(): Promise<SessionPayload> {
  return fetchJson<SessionPayload>("/api/operator/session");
}
